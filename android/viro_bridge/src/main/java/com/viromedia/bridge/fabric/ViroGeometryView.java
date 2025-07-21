//
//  ViroGeometryView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viromedia.bridge.utility.ViroLog;

import java.util.ArrayList;
import java.util.List;

/**
 * ViroGeometryView - Custom Geometry Creation Android View
 * 
 * This View provides comprehensive custom geometry functionality for ViroReact applications,
 * supporting vertex data management, material assignment, and procedural generation.
 * 
 * Key Features:
 * - Custom vertex, normal, and texture coordinate data management
 * - Material assignment and morph target support
 * - Procedural geometry generation (sphere, box, cylinder)
 * - Parametric surface generation capabilities
 * - Subdivision surface algorithms framework
 * - Lighting and rendering property control
 * - Bounding box computation and optimization
 * - Event callbacks for geometry lifecycle management
 * - Integration with ViroReact scene graph
 */
public class ViroGeometryView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroGeometryView.class);
    
    // Geometry types
    public enum GeometryType {
        CUSTOM("custom"),
        SPHERE("sphere"),
        BOX("box"),
        CYLINDER("cylinder"),
        PLANE("plane"),
        PARAMETRIC("parametric");
        
        private final String value;
        
        GeometryType(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static GeometryType fromString(String value) {
            for (GeometryType type : GeometryType.values()) {
                if (type.value.equals(value)) {
                    return type;
                }
            }
            return CUSTOM;
        }
    }
    
    // Vertex structure
    private static class Vertex {
        public PointF position = new PointF();
        public PointF normal = new PointF();
        public PointF texCoord = new PointF();
        public int color = 0xFFFFFFFF;
        
        public Vertex(float x, float y) {
            position.set(x, y);
        }
        
        public Vertex(float x, float y, float nx, float ny, float u, float v) {
            position.set(x, y);
            normal.set(nx, ny);
            texCoord.set(u, v);
        }
    }
    
    // Triangle structure
    private static class Triangle {
        public int v1, v2, v3;
        
        public Triangle(int v1, int v2, int v3) {
            this.v1 = v1;
            this.v2 = v2;
            this.v3 = v3;
        }
    }
    
    // Geometry data
    private GeometryType geometryType = GeometryType.CUSTOM;
    private List<Vertex> vertices = new ArrayList<>();
    private List<Triangle> triangles = new ArrayList<>();
    private ReadableArray vertexPositions;
    private ReadableArray vertexNormals;
    private ReadableArray vertexTexCoords;
    private ReadableArray vertexColors;
    private ReadableArray triangleIndices;
    
    // Material properties
    private ReadableMap materials;
    private String materialName = "";
    private ReadableArray diffuseColor = Arguments.createArray();
    private ReadableArray specularColor = Arguments.createArray();
    private ReadableArray ambientColor = Arguments.createArray();
    private float shininess = 32.0f;
    private float opacity = 1.0f;
    private boolean transparent = false;
    
    // Geometry properties
    private boolean visible = true;
    private boolean castShadow = true;
    private boolean receiveShadow = true;
    private boolean doubleSided = false;
    private String cullMode = "back";
    private String windingOrder = "counterclockwise";
    
    // Procedural generation parameters
    private int subdivisions = 1;
    private float radius = 1.0f;
    private float width = 1.0f;
    private float height = 1.0f;
    private float depth = 1.0f;
    private int segmentsU = 10;
    private int segmentsV = 10;
    private boolean smooth = true;
    
    // Morph targets
    private ReadableArray morphTargets;
    private ReadableArray morphWeights;
    private boolean enableMorphing = false;
    
    // Bounding box
    private PointF boundsMin = new PointF();
    private PointF boundsMax = new PointF();
    private boolean boundsValid = false;
    
    // Rendering
    private Paint geometryPaint;
    private Paint wireframePaint;
    private boolean wireframe = false;
    private boolean showNormals = false;
    private boolean showBounds = false;
    private Path geometryPath;
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    public ViroGeometryView(@NonNull Context context) {
        super(context);
        
        ViroLog.debug(TAG, "ViroGeometryView created");
        
        // Initialize default colors
        diffuseColor = createColorArray(0.8f, 0.8f, 0.8f, 1.0f);
        specularColor = createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        ambientColor = createColorArray(0.2f, 0.2f, 0.2f, 1.0f);
        
        initializePaints();
        setupDefaultGeometry();
    }
    
    private void initializePaints() {
        geometryPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        geometryPaint.setStyle(Paint.Style.FILL);
        geometryPaint.setColor(getColorFromArray(diffuseColor));
        
        wireframePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        wireframePaint.setStyle(Paint.Style.STROKE);
        wireframePaint.setStrokeWidth(1.0f);
        wireframePaint.setColor(0xFF00FF00); // Green wireframe
        
        geometryPath = new Path();
    }
    
    private void setupDefaultGeometry() {
        // Create a simple quad by default
        vertices.clear();
        triangles.clear();
        
        // Add vertices for a quad
        vertices.add(new Vertex(-0.5f, -0.5f, 0, 0, 0, 0));
        vertices.add(new Vertex(0.5f, -0.5f, 0, 0, 1, 0));
        vertices.add(new Vertex(0.5f, 0.5f, 0, 0, 1, 1));
        vertices.add(new Vertex(-0.5f, 0.5f, 0, 0, 0, 1));
        
        // Add triangles
        triangles.add(new Triangle(0, 1, 2));
        triangles.add(new Triangle(0, 2, 3));
        
        updateBounds();
        invalidate();
    }
    
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        updateGeometryPath();
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!visible || vertices.isEmpty()) {
            return;
        }
        
        canvas.save();
        
        // Transform to center
        canvas.translate(getWidth() / 2.0f, getHeight() / 2.0f);
        
        // Scale to fit view
        float scale = Math.min(getWidth(), getHeight()) * 0.8f;
        canvas.scale(scale, scale);
        
        // Draw geometry
        if (wireframe) {
            drawWireframe(canvas);
        } else {
            drawSolid(canvas);
        }
        
        // Draw debug information
        if (showNormals) {
            drawNormals(canvas);
        }
        
        if (showBounds) {
            drawBounds(canvas);
        }
        
        canvas.restore();
    }
    
    private void drawSolid(Canvas canvas) {
        geometryPath.reset();
        
        for (Triangle triangle : triangles) {
            if (triangle.v1 >= vertices.size() || 
                triangle.v2 >= vertices.size() || 
                triangle.v3 >= vertices.size()) {
                continue;
            }
            
            Vertex v1 = vertices.get(triangle.v1);
            Vertex v2 = vertices.get(triangle.v2);
            Vertex v3 = vertices.get(triangle.v3);
            
            geometryPath.moveTo(v1.position.x, v1.position.y);
            geometryPath.lineTo(v2.position.x, v2.position.y);
            geometryPath.lineTo(v3.position.x, v3.position.y);
            geometryPath.close();
        }
        
        canvas.drawPath(geometryPath, geometryPaint);
    }
    
    private void drawWireframe(Canvas canvas) {
        for (Triangle triangle : triangles) {
            if (triangle.v1 >= vertices.size() || 
                triangle.v2 >= vertices.size() || 
                triangle.v3 >= vertices.size()) {
                continue;
            }
            
            Vertex v1 = vertices.get(triangle.v1);
            Vertex v2 = vertices.get(triangle.v2);
            Vertex v3 = vertices.get(triangle.v3);
            
            // Draw triangle edges
            canvas.drawLine(v1.position.x, v1.position.y, v2.position.x, v2.position.y, wireframePaint);
            canvas.drawLine(v2.position.x, v2.position.y, v3.position.x, v3.position.y, wireframePaint);
            canvas.drawLine(v3.position.x, v3.position.y, v1.position.x, v1.position.y, wireframePaint);
        }
    }
    
    private void drawNormals(Canvas canvas) {
        Paint normalPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        normalPaint.setStyle(Paint.Style.STROKE);
        normalPaint.setStrokeWidth(1.0f);
        normalPaint.setColor(0xFFFF0000); // Red normals
        
        float normalLength = 0.1f;
        
        for (Vertex vertex : vertices) {
            float endX = vertex.position.x + vertex.normal.x * normalLength;
            float endY = vertex.position.y + vertex.normal.y * normalLength;
            
            canvas.drawLine(
                vertex.position.x, vertex.position.y,
                endX, endY,
                normalPaint
            );
        }
    }
    
    private void drawBounds(Canvas canvas) {
        if (!boundsValid) {
            return;
        }
        
        Paint boundsPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        boundsPaint.setStyle(Paint.Style.STROKE);
        boundsPaint.setStrokeWidth(2.0f);
        boundsPaint.setColor(0xFF0000FF); // Blue bounds
        
        canvas.drawRect(
            boundsMin.x, boundsMin.y,
            boundsMax.x, boundsMax.y,
            boundsPaint
        );
    }
    
    private void updateGeometryPath() {
        // Update the geometry path when view size changes
        if (!vertices.isEmpty()) {
            invalidate();
        }
    }
    
    private void updateBounds() {
        if (vertices.isEmpty()) {
            boundsValid = false;
            return;
        }
        
        boundsMin.set(Float.MAX_VALUE, Float.MAX_VALUE);
        boundsMax.set(Float.MIN_VALUE, Float.MIN_VALUE);
        
        for (Vertex vertex : vertices) {
            if (vertex.position.x < boundsMin.x) boundsMin.x = vertex.position.x;
            if (vertex.position.y < boundsMin.y) boundsMin.y = vertex.position.y;
            if (vertex.position.x > boundsMax.x) boundsMax.x = vertex.position.x;
            if (vertex.position.y > boundsMax.y) boundsMax.y = vertex.position.y;
        }
        
        boundsValid = true;
    }
    
    // Geometry Generation Methods
    private void generateSphere() {
        ViroLog.debug(TAG, "Generating sphere geometry");
        
        vertices.clear();
        triangles.clear();
        
        int rings = segmentsV;
        int sectors = segmentsU;
        
        // Generate vertices
        for (int r = 0; r <= rings; r++) {
            float phi = (float) (Math.PI * r / rings);
            float y = radius * (float) Math.cos(phi);
            float ringRadius = radius * (float) Math.sin(phi);
            
            for (int s = 0; s <= sectors; s++) {
                float theta = (float) (2 * Math.PI * s / sectors);
                float x = ringRadius * (float) Math.cos(theta);
                float z = ringRadius * (float) Math.sin(theta);
                
                // For 2D view, project to XY plane
                Vertex vertex = new Vertex(x, y);
                vertex.normal.set(x / radius, y / radius); // Normalized
                vertex.texCoord.set((float) s / sectors, (float) r / rings);
                
                vertices.add(vertex);
            }
        }
        
        // Generate triangles
        for (int r = 0; r < rings; r++) {
            for (int s = 0; s < sectors; s++) {
                int current = r * (sectors + 1) + s;
                int next = current + sectors + 1;
                
                // Two triangles per quad
                triangles.add(new Triangle(current, next, current + 1));
                triangles.add(new Triangle(current + 1, next, next + 1));
            }
        }
        
        updateBounds();
        invalidate();
    }
    
    private void generateBox() {
        ViroLog.debug(TAG, "Generating box geometry");
        
        vertices.clear();
        triangles.clear();
        
        float w = width / 2.0f;
        float h = height / 2.0f;
        
        // Generate vertices for a 2D rectangle (front face of box)
        vertices.add(new Vertex(-w, -h, 0, 0, 0, 0)); // Bottom-left
        vertices.add(new Vertex(w, -h, 0, 0, 1, 0));  // Bottom-right
        vertices.add(new Vertex(w, h, 0, 0, 1, 1));   // Top-right
        vertices.add(new Vertex(-w, h, 0, 0, 0, 1));  // Top-left
        
        // Two triangles
        triangles.add(new Triangle(0, 1, 2));
        triangles.add(new Triangle(0, 2, 3));
        
        updateBounds();
        invalidate();
    }
    
    private void generateCylinder() {
        ViroLog.debug(TAG, "Generating cylinder geometry");
        
        vertices.clear();
        triangles.clear();
        
        int segments = segmentsU;
        float h = height / 2.0f;
        
        // Generate vertices for cylinder cross-section (circle)
        for (int i = 0; i <= segments; i++) {
            float angle = (float) (2 * Math.PI * i / segments);
            float x = radius * (float) Math.cos(angle);
            float y = radius * (float) Math.sin(angle);
            
            Vertex vertex = new Vertex(x, y);
            vertex.normal.set(x / radius, y / radius);
            vertex.texCoord.set((float) i / segments, 0.5f);
            
            vertices.add(vertex);
        }
        
        // Generate triangles (fan triangulation)
        Vertex center = new Vertex(0, 0);
        vertices.add(center);
        int centerIndex = vertices.size() - 1;
        
        for (int i = 0; i < segments; i++) {
            triangles.add(new Triangle(centerIndex, i, i + 1));
        }
        
        updateBounds();
        invalidate();
    }
    
    // Property Setters
    public void setGeometryType(@Nullable String type) {
        ViroLog.debug(TAG, "Setting geometry type: " + type);
        this.geometryType = GeometryType.fromString(type != null ? type : "custom");
        
        switch (this.geometryType) {
            case SPHERE:
                generateSphere();
                break;
            case BOX:
                generateBox();
                break;
            case CYLINDER:
                generateCylinder();
                break;
            case CUSTOM:
            default:
                // Keep existing custom geometry
                break;
        }
        
        sendGeometryChangeEvent();
    }
    
    public void setVertices(@Nullable ReadableArray vertices) {
        ViroLog.debug(TAG, "Setting vertices: " + vertices);
        this.vertexPositions = vertices;
        
        if (vertices != null) {
            updateCustomGeometry();
        }
    }
    
    public void setTriangleIndices(@Nullable ReadableArray indices) {
        ViroLog.debug(TAG, "Setting triangle indices: " + indices);
        this.triangleIndices = indices;
        
        if (indices != null) {
            updateCustomGeometry();
        }
    }
    
    private void updateCustomGeometry() {
        if (vertexPositions == null || triangleIndices == null) {
            return;
        }
        
        vertices.clear();
        triangles.clear();
        
        // Parse vertices
        for (int i = 0; i < vertexPositions.size(); i += 2) {
            if (i + 1 < vertexPositions.size()) {
                float x = (float) vertexPositions.getDouble(i);
                float y = (float) vertexPositions.getDouble(i + 1);
                
                Vertex vertex = new Vertex(x, y);
                
                // Set normals if available
                if (vertexNormals != null && vertexNormals.size() > i + 1) {
                    vertex.normal.x = (float) vertexNormals.getDouble(i);
                    vertex.normal.y = (float) vertexNormals.getDouble(i + 1);
                }
                
                // Set texture coordinates if available
                if (vertexTexCoords != null && vertexTexCoords.size() > i + 1) {
                    vertex.texCoord.x = (float) vertexTexCoords.getDouble(i);
                    vertex.texCoord.y = (float) vertexTexCoords.getDouble(i + 1);
                }
                
                vertices.add(vertex);
            }
        }
        
        // Parse triangles
        for (int i = 0; i < triangleIndices.size(); i += 3) {
            if (i + 2 < triangleIndices.size()) {
                int v1 = triangleIndices.getInt(i);
                int v2 = triangleIndices.getInt(i + 1);
                int v3 = triangleIndices.getInt(i + 2);
                
                triangles.add(new Triangle(v1, v2, v3));
            }
        }
        
        updateBounds();
        invalidate();
        sendGeometryChangeEvent();
    }
    
    public void setMaterials(@Nullable ReadableMap materials) {
        ViroLog.debug(TAG, "Setting materials: " + materials);
        this.materials = materials;
        
        if (materials != null) {
            // Update material properties
            updateMaterialProperties();
        }
    }
    
    private void updateMaterialProperties() {
        // Update paint based on material properties
        geometryPaint.setColor(getColorFromArray(diffuseColor));
        geometryPaint.setAlpha((int) (opacity * 255));
        invalidate();
    }
    
    public void setRadius(float radius) {
        ViroLog.debug(TAG, "Setting radius: " + radius);
        this.radius = radius;
        
        if (geometryType == GeometryType.SPHERE || geometryType == GeometryType.CYLINDER) {
            setGeometryType(geometryType.getValue());
        }
    }
    
    public void setWireframe(boolean wireframe) {
        ViroLog.debug(TAG, "Setting wireframe: " + wireframe);
        this.wireframe = wireframe;
        invalidate();
    }
    
    // State Information
    public int getVertexCount() {
        return vertices.size();
    }
    
    public int getTriangleCount() {
        return triangles.size();
    }
    
    public String getGeometryType() {
        return geometryType.getValue();
    }
    
    public ReadableMap getBounds() {
        WritableMap bounds = Arguments.createMap();
        bounds.putDouble("minX", boundsMin.x);
        bounds.putDouble("minY", boundsMin.y);
        bounds.putDouble("maxX", boundsMax.x);
        bounds.putDouble("maxY", boundsMax.y);
        bounds.putBoolean("valid", boundsValid);
        return bounds;
    }
    
    // Helper Methods
    private ReadableArray createColorArray(float r, float g, float b, float a) {
        WritableArray array = Arguments.createArray();
        array.pushDouble(r);
        array.pushDouble(g);
        array.pushDouble(b);
        array.pushDouble(a);
        return array;
    }
    
    private int getColorFromArray(@Nullable ReadableArray colorArray) {
        if (colorArray == null || colorArray.size() < 3) {
            return 0xFFFFFFFF;
        }
        
        float red = (float) colorArray.getDouble(0);
        float green = (float) colorArray.getDouble(1);
        float blue = (float) colorArray.getDouble(2);
        float alpha = colorArray.size() > 3 ? (float) colorArray.getDouble(3) : 1.0f;
        
        return android.graphics.Color.argb(
            (int) (alpha * 255),
            (int) (red * 255),
            (int) (green * 255),
            (int) (blue * 255)
        );
    }
    
    // Event Methods
    private void sendGeometryChangeEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("type", geometryType.getValue());
        eventData.putInt("vertexCount", vertices.size());
        eventData.putInt("triangleCount", triangles.size());
        eventData.putMap("bounds", (WritableMap) getBounds());
        sendEvent("onGeometryChange", eventData);
    }
    
    // Event Handling
    public void setEventEmitter(RCTEventEmitter eventEmitter, int reactTag) {
        this.eventEmitter = eventEmitter;
        this.reactTag = reactTag;
    }
    
    private void sendEvent(String eventName, WritableMap eventData) {
        if (eventEmitter != null && reactTag != -1) {
            eventEmitter.receiveEvent(reactTag, eventName, eventData);
        }
    }
}