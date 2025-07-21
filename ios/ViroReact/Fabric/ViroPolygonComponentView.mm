//
//  ViroPolygonComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroPolygonComponentView.h"
#import <React/RCTAssert.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <SceneKit/SceneKit.h>
#import <ModelIO/ModelIO.h>

@interface ViroPolygonComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROGeometry> vroGeometry;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;
@property (nonatomic, strong) std::shared_ptr<VROGeometrySource> vroGeometrySource;

// SceneKit components
@property (nonatomic, strong) SCNNode *polygonNode;
@property (nonatomic, strong) SCNGeometry *polygonGeometry;
@property (nonatomic, strong) NSMutableArray<SCNMaterial *> *polygonMaterials;

// Geometry data
@property (nonatomic, strong) NSMutableArray<NSValue *> *processedVertices;
@property (nonatomic, strong) NSMutableArray<NSNumber *> *triangleIndices;
@property (nonatomic, strong) NSMutableArray<NSValue *> *calculatedNormals;
@property (nonatomic, strong) NSMutableArray<NSValue *> *generatedUVs;

// Tessellation state
@property (nonatomic, assign) BOOL needsRetessellation;
@property (nonatomic, assign) BOOL geometryDirty;

@end

@implementation ViroPolygonComponentView

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroPolygonComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        [self commonInit];
    }
    return self;
}

- (void)commonInit
{
    // Initialize default values
    _vertices = @[];
    _holes = @[];
    _uvCoordinates = @[];
    _normals = @[];
    _colors = @[];
    _thickness = 0.0f;
    _facesOutward = YES;
    _tessellationFactor = 1;
    _tessellationMode = @"uniform";
    _materials = @[];
    
    // Initialize collections
    _processedVertices = [NSMutableArray array];
    _triangleIndices = [NSMutableArray array];
    _calculatedNormals = [NSMutableArray array];
    _generatedUVs = [NSMutableArray array];
    _polygonMaterials = [NSMutableArray array];
    
    // Initialize state
    _needsRetessellation = YES;
    _geometryDirty = YES;
    
    // Initialize ViroReact polygon
    [self initializeVROPolygon];
    
    // Setup SceneKit components
    [self setupSceneKitComponents];
}

#pragma mark - ViroReact Integration

- (void)initializeVROPolygon
{
    RCTLogInfo(@"[ViroPolygonComponentView] Creating VROGeometry");
    
    // Create VROGeometry for polygon
    _vroGeometry = VROGeometry::create();
    
    // Create VRONode to hold the polygon
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroGeometry);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    RCTLogInfo(@"[ViroPolygonComponentView] VROGeometry created successfully");
}

- (void)updateVROPolygon
{
    if (!_vroGeometry || _vertices.count < 3) {
        return;
    }
    
    RCTLogInfo(@"[ViroPolygonComponentView] Updating VROPolygon with %lu vertices", (unsigned long)_vertices.count);
    
    // Build polygon geometry from vertices
    [self buildPolygonVROGeometry];
    
    // Apply thickness if specified
    if (_thickness > 0.0f) {
        [self applyPolygonThickness];
    }
}

- (void)buildPolygonVROGeometry
{
    if (_vertices.count < 3) {
        RCTLogWarn(@"[ViroPolygonComponentView] Need at least 3 vertices for polygon");
        return;
    }
    
    // Convert vertices to ViroKit format
    std::vector<VROVector3f> vertices;
    for (NSArray<NSNumber *> *vertex in _vertices) {
        if (vertex.count >= 2) {
            float x = [vertex[0] floatValue];
            float y = [vertex[1] floatValue];
            float z = vertex.count > 2 ? [vertex[2] floatValue] : 0.0f;
            vertices.push_back(VROVector3f(x, y, z));
        }
    }
    
    // Tessellate polygon into triangles
    std::vector<int> indices = [self tessellatePolygon:vertices];
    
    // Generate normals
    std::vector<VROVector3f> normals;
    if (_normals.count > 0) {
        // Use provided normals
        for (int i = 0; i < _normals.count; i += 3) {
            if (i + 2 < _normals.count) {
                float nx = [_normals[i] floatValue];
                float ny = [_normals[i + 1] floatValue];
                float nz = [_normals[i + 2] floatValue];
                normals.push_back(VROVector3f(nx, ny, nz));
            }
        }
    } else {
        // Generate normals automatically
        normals = [self generateNormals:vertices indices:indices];
    }
    
    // Generate UV coordinates
    std::vector<VROVector3f> texcoords;
    if (_uvCoordinates.count > 0) {
        // Use provided UV coordinates
        for (int i = 0; i < _uvCoordinates.count; i += 2) {
            if (i + 1 < _uvCoordinates.count) {
                float u = [_uvCoordinates[i] floatValue];
                float v = [_uvCoordinates[i + 1] floatValue];
                texcoords.push_back(VROVector3f(u, v, 0.0f));
            }
        }
    } else {
        // Generate UV coordinates automatically
        texcoords = [self generateUVCoordinates:vertices];
    }
    
    // Create VROGeometrySource and apply to geometry
    _vroGeometrySource = VROGeometrySource::create(vertices, normals, texcoords, indices);
    _vroGeometry->setGeometrySources({ _vroGeometrySource });
}

- (std::vector<int>)tessellatePolygon:(const std::vector<VROVector3f>&)vertices
{
    std::vector<int> indices;
    
    // Simple fan triangulation for convex polygons
    // For complex polygons, this should use a proper tessellation library
    for (int i = 1; i < vertices.size() - 1; i++) {
        indices.push_back(0);
        indices.push_back(i);
        indices.push_back(i + 1);
    }
    
    return indices;
}

- (std::vector<VROVector3f>)generateNormals:(const std::vector<VROVector3f>&)vertices indices:(const std::vector<int>&)indices
{
    std::vector<VROVector3f> normals(vertices.size(), VROVector3f(0, 0, 1));
    
    // For a flat polygon, all normals point in the same direction
    VROVector3f normal = _facesOutward ? VROVector3f(0, 0, 1) : VROVector3f(0, 0, -1);
    
    for (int i = 0; i < normals.size(); i++) {
        normals[i] = normal;
    }
    
    return normals;
}

- (std::vector<VROVector3f>)generateUVCoordinates:(const std::vector<VROVector3f>&)vertices
{
    std::vector<VROVector3f> uvs;
    
    // Find bounding box for UV mapping
    float minX = INFINITY, maxX = -INFINITY;
    float minY = INFINITY, maxY = -INFINITY;
    
    for (const auto& vertex : vertices) {
        minX = std::min(minX, vertex.x);
        maxX = std::max(maxX, vertex.x);
        minY = std::min(minY, vertex.y);
        maxY = std::max(maxY, vertex.y);
    }
    
    float width = maxX - minX;
    float height = maxY - minY;
    
    // Generate UV coordinates based on vertex positions
    for (const auto& vertex : vertices) {
        float u = width > 0 ? (vertex.x - minX) / width : 0.0f;
        float v = height > 0 ? (vertex.y - minY) / height : 0.0f;
        uvs.push_back(VROVector3f(u, v, 0.0f));
    }
    
    return uvs;
}

- (void)applyPolygonThickness
{
    if (_thickness <= 0.0f) {
        return;
    }
    
    RCTLogInfo(@"[ViroPolygonComponentView] Applying thickness: %.2f", _thickness);
    
    // TODO: Implement polygon extrusion for thickness
    // This would create additional geometry to give the polygon depth
}

- (void)setupSceneKitComponents
{
    _polygonNode = [SCNNode node];
    _polygonNode.name = @"ViroPolygon";
    
    // Create initial geometry
    [self updateGeometry];
}

#pragma mark - Property Setters

- (void)setVertices:(NSArray<NSArray<NSNumber *> *> *)vertices
{
    _vertices = vertices;
    _geometryDirty = YES;
    _needsRetessellation = YES;
    [self updateGeometry];
    
    // Update ViroReact geometry
    [self updateVROPolygon];
}

- (void)setHoles:(NSArray<NSArray<NSNumber *> *> *)holes
{
    _holes = holes;
    _geometryDirty = YES;
    _needsRetessellation = YES;
    [self updateGeometry];
}

- (void)setUvCoordinates:(NSArray<NSNumber *> *)uvCoordinates
{
    _uvCoordinates = uvCoordinates;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setNormals:(NSArray<NSNumber *> *)normals
{
    _normals = normals;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setColors:(NSArray<NSNumber *> *)colors
{
    _colors = colors;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setThickness:(CGFloat)thickness
{
    _thickness = thickness;
    _geometryDirty = YES;
    [self updateGeometry];
    
    // Update ViroReact geometry
    [self updateVROPolygon];
}

- (void)setFacesOutward:(BOOL)facesOutward
{
    _facesOutward = facesOutward;
    _geometryDirty = YES;
    [self updateGeometry];
    
    // Update ViroReact geometry
    [self updateVROPolygon];
}

- (void)setTessellationFactor:(NSInteger)tessellationFactor
{
    _tessellationFactor = tessellationFactor;
    _needsRetessellation = YES;
    [self updateGeometry];
}

- (void)setTessellationMode:(NSString *)tessellationMode
{
    _tessellationMode = tessellationMode;
    _needsRetessellation = YES;
    [self updateGeometry];
}

- (void)setMaterials:(NSArray<NSString *> *)materials
{
    _materials = materials;
    [self updateMaterials];
}

#pragma mark - Geometry Processing

- (void)updateGeometry
{
    if (!_geometryDirty) return;
    
    // Process vertices
    [self processVertices];
    
    // Tessellate polygon
    [self tessellatePolygon];
    
    // Calculate normals if not provided
    if (_normals.count == 0) {
        [self calculateNormals];
    }
    
    // Generate UV coordinates if not provided
    if (_uvCoordinates.count == 0) {
        [self generateUVCoordinates];
    }
    
    // Create SceneKit geometry
    [self createSceneKitGeometry];
    
    // Update materials
    [self updateMaterials];
    
    _geometryDirty = NO;
}

- (void)processVertices
{
    [_processedVertices removeAllObjects];
    
    // Process main vertices
    for (NSArray<NSNumber *> *vertex in _vertices) {
        if (vertex.count >= 2) {
            float x = [vertex[0] floatValue];
            float y = [vertex[1] floatValue];
            float z = vertex.count > 2 ? [vertex[2] floatValue] : 0.0f;
            
            SCNVector3 position = SCNVector3Make(x, y, z);
            [_processedVertices addObject:[NSValue valueWithSCNVector3:position]];
        }
    }
}

- (void)tessellatePolygon
{
    if (!_needsRetessellation) return;
    
    [_triangleIndices removeAllObjects];
    
    // Simple triangulation for now (ear clipping algorithm)
    NSMutableArray<NSNumber *> *remainingIndices = [NSMutableArray array];
    for (NSInteger i = 0; i < _processedVertices.count; i++) {
        [remainingIndices addObject:@(i)];
    }
    
    while (remainingIndices.count > 3) {
        BOOL foundEar = NO;
        
        for (NSInteger i = 0; i < remainingIndices.count; i++) {
            NSInteger prevIndex = (i - 1 + remainingIndices.count) % remainingIndices.count;
            NSInteger currIndex = i;
            NSInteger nextIndex = (i + 1) % remainingIndices.count;
            
            NSInteger a = [remainingIndices[prevIndex] integerValue];
            NSInteger b = [remainingIndices[currIndex] integerValue];
            NSInteger c = [remainingIndices[nextIndex] integerValue];
            
            if ([self isEar:a b:b c:c remainingIndices:remainingIndices]) {
                // Add triangle
                [_triangleIndices addObject:@(a)];
                [_triangleIndices addObject:@(b)];
                [_triangleIndices addObject:@(c)];
                
                // Remove ear vertex
                [remainingIndices removeObjectAtIndex:currIndex];
                foundEar = YES;
                break;
            }
        }
        
        if (!foundEar) {
            // Fallback: just create a triangle fan
            NSInteger center = [remainingIndices[0] integerValue];
            for (NSInteger i = 1; i < remainingIndices.count - 1; i++) {
                [_triangleIndices addObject:@(center)];
                [_triangleIndices addObject:remainingIndices[i]];
                [_triangleIndices addObject:remainingIndices[i + 1]];
            }
            break;
        }
    }
    
    // Add final triangle
    if (remainingIndices.count == 3) {
        [_triangleIndices addObject:remainingIndices[0]];
        [_triangleIndices addObject:remainingIndices[1]];
        [_triangleIndices addObject:remainingIndices[2]];
    }
    
    _needsRetessellation = NO;
}

- (BOOL)isEar:(NSInteger)a b:(NSInteger)b c:(NSInteger)c remainingIndices:(NSArray<NSNumber *> *)remainingIndices
{
    if (a >= _processedVertices.count || b >= _processedVertices.count || c >= _processedVertices.count) {
        return NO;
    }
    
    SCNVector3 va = [_processedVertices[a] SCNVector3Value];
    SCNVector3 vb = [_processedVertices[b] SCNVector3Value];
    SCNVector3 vc = [_processedVertices[c] SCNVector3Value];
    
    // Check if triangle is convex
    SCNVector3 ab = SCNVector3Make(vb.x - va.x, vb.y - va.y, vb.z - va.z);
    SCNVector3 bc = SCNVector3Make(vc.x - vb.x, vc.y - vb.y, vc.z - vb.z);
    
    // Cross product to check orientation
    float cross = ab.x * bc.y - ab.y * bc.x;
    if (cross <= 0) {
        return NO; // Not convex
    }
    
    // Check if any other vertex is inside the triangle
    for (NSNumber *indexNumber in remainingIndices) {
        NSInteger index = [indexNumber integerValue];
        if (index != a && index != b && index != c) {
            SCNVector3 vp = [_processedVertices[index] SCNVector3Value];
            if ([self isPointInTriangle:vp a:va b:vb c:vc]) {
                return NO;
            }
        }
    }
    
    return YES;
}

- (BOOL)isPointInTriangle:(SCNVector3)p a:(SCNVector3)a b:(SCNVector3)b c:(SCNVector3)c
{
    // Barycentric coordinates
    float denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (fabs(denom) < 1e-6) return NO;
    
    float alpha = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denom;
    float beta = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denom;
    float gamma = 1.0f - alpha - beta;
    
    return alpha >= 0 && beta >= 0 && gamma >= 0;
}

- (void)calculateNormals
{
    [_calculatedNormals removeAllObjects];
    
    // Initialize normal array
    for (NSInteger i = 0; i < _processedVertices.count; i++) {
        [_calculatedNormals addObject:[NSValue valueWithSCNVector3:SCNVector3Make(0, 0, 0)]];
    }
    
    // Calculate face normals and accumulate
    for (NSInteger i = 0; i < _triangleIndices.count; i += 3) {
        NSInteger ia = [_triangleIndices[i] integerValue];
        NSInteger ib = [_triangleIndices[i + 1] integerValue];
        NSInteger ic = [_triangleIndices[i + 2] integerValue];
        
        SCNVector3 va = [_processedVertices[ia] SCNVector3Value];
        SCNVector3 vb = [_processedVertices[ib] SCNVector3Value];
        SCNVector3 vc = [_processedVertices[ic] SCNVector3Value];
        
        // Calculate face normal
        SCNVector3 ab = SCNVector3Make(vb.x - va.x, vb.y - va.y, vb.z - va.z);
        SCNVector3 ac = SCNVector3Make(vc.x - va.x, vc.y - va.y, vc.z - va.z);
        
        SCNVector3 normal = SCNVector3Make(
            ab.y * ac.z - ab.z * ac.y,
            ab.z * ac.x - ab.x * ac.z,
            ab.x * ac.y - ab.y * ac.x
        );
        
        // Normalize
        float length = sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        if (length > 0) {
            normal.x /= length;
            normal.y /= length;
            normal.z /= length;
        }
        
        if (!_facesOutward) {
            normal.x = -normal.x;
            normal.y = -normal.y;
            normal.z = -normal.z;
        }
        
        // Accumulate normals for vertices
        SCNVector3 na = [_calculatedNormals[ia] SCNVector3Value];
        SCNVector3 nb = [_calculatedNormals[ib] SCNVector3Value];
        SCNVector3 nc = [_calculatedNormals[ic] SCNVector3Value];
        
        na.x += normal.x; na.y += normal.y; na.z += normal.z;
        nb.x += normal.x; nb.y += normal.y; nb.z += normal.z;
        nc.x += normal.x; nc.y += normal.y; nc.z += normal.z;
        
        _calculatedNormals[ia] = [NSValue valueWithSCNVector3:na];
        _calculatedNormals[ib] = [NSValue valueWithSCNVector3:nb];
        _calculatedNormals[ic] = [NSValue valueWithSCNVector3:nc];
    }
    
    // Normalize accumulated normals
    for (NSInteger i = 0; i < _calculatedNormals.count; i++) {
        SCNVector3 normal = [_calculatedNormals[i] SCNVector3Value];
        float length = sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        if (length > 0) {
            normal.x /= length;
            normal.y /= length;
            normal.z /= length;
        }
        _calculatedNormals[i] = [NSValue valueWithSCNVector3:normal];
    }
}

- (void)generateUVCoordinates
{
    [_generatedUVs removeAllObjects];
    
    // Find bounding box
    float minX = INFINITY, maxX = -INFINITY;
    float minY = INFINITY, maxY = -INFINITY;
    
    for (NSValue *vertexValue in _processedVertices) {
        SCNVector3 vertex = [vertexValue SCNVector3Value];
        minX = MIN(minX, vertex.x);
        maxX = MAX(maxX, vertex.x);
        minY = MIN(minY, vertex.y);
        maxY = MAX(maxY, vertex.y);
    }
    
    float width = maxX - minX;
    float height = maxY - minY;
    
    // Generate UV coordinates based on projected position
    for (NSValue *vertexValue in _processedVertices) {
        SCNVector3 vertex = [vertexValue SCNVector3Value];
        float u = width > 0 ? (vertex.x - minX) / width : 0.0f;
        float v = height > 0 ? (vertex.y - minY) / height : 0.0f;
        
        [_generatedUVs addObject:[NSValue valueWithCGPoint:CGPointMake(u, v)]];
    }
}

- (void)createSceneKitGeometry
{
    if (_processedVertices.count == 0 || _triangleIndices.count == 0) {
        return;
    }
    
    // Create vertex data
    NSMutableArray<NSValue *> *vertices = [NSMutableArray array];
    NSMutableArray<NSValue *> *normals = [NSMutableArray array];
    NSMutableArray<NSValue *> *uvs = [NSMutableArray array];
    
    for (NSInteger i = 0; i < _processedVertices.count; i++) {
        [vertices addObject:_processedVertices[i]];
        
        if (i < _calculatedNormals.count) {
            [normals addObject:_calculatedNormals[i]];
        } else {
            [normals addObject:[NSValue valueWithSCNVector3:SCNVector3Make(0, 0, 1)]];
        }
        
        if (i < _generatedUVs.count) {
            [uvs addObject:_generatedUVs[i]];
        } else {
            [uvs addObject:[NSValue valueWithCGPoint:CGPointMake(0, 0)]];
        }
    }
    
    // Create SCNGeometry
    SCNGeometrySource *vertexSource = [SCNGeometrySource geometrySourceWithVertices:(SCNVector3 *)[vertices.firstObject pointerValue] count:vertices.count];
    SCNGeometrySource *normalSource = [SCNGeometrySource geometrySourceWithNormals:(SCNVector3 *)[normals.firstObject pointerValue] count:normals.count];
    SCNGeometrySource *uvSource = [SCNGeometrySource geometrySourceWithTextureCoordinates:(CGPoint *)[uvs.firstObject pointerValue] count:uvs.count];
    
    // Create triangle data
    NSData *indexData = [NSData dataWithBytes:_triangleIndices.firstObject length:_triangleIndices.count * sizeof(uint32_t)];
    SCNGeometryElement *element = [SCNGeometryElement geometryElementWithData:indexData
                                                                primitiveType:SCNGeometryPrimitiveTypeTriangles
                                                               primitiveCount:_triangleIndices.count / 3
                                                                bytesPerIndex:sizeof(uint32_t)];
    
    _polygonGeometry = [SCNGeometry geometryWithSources:@[vertexSource, normalSource, uvSource] elements:@[element]];
    
    // Handle thickness (extrusion)
    if (_thickness > 0) {
        [self extrudeGeometry];
    }
    
    // Assign geometry to node
    _polygonNode.geometry = _polygonGeometry;
}

- (void)extrudeGeometry
{
    // For now, just apply thickness as a simple scaling
    // A full extrusion would require more complex geometry generation
    _polygonNode.scale = SCNVector3Make(1.0f, 1.0f, _thickness);
}

- (void)updateMaterials
{
    [_polygonMaterials removeAllObjects];
    
    if (_materials.count == 0) {
        // Create default material
        SCNMaterial *material = [SCNMaterial material];
        material.diffuse.contents = [UIColor whiteColor];
        material.lightingModelName = SCNLightingModelLambert;
        [_polygonMaterials addObject:material];
    } else {
        // Create materials from material names
        for (NSString *materialName in _materials) {
            SCNMaterial *material = [SCNMaterial material];
            material.name = materialName;
            material.lightingModelName = SCNLightingModelLambert;
            [_polygonMaterials addObject:material];
        }
    }
    
    _polygonGeometry.materials = _polygonMaterials;
}

#pragma mark - Touch Handling

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
    [super touchesBegan:touches withEvent:event];
    
    if (_onClick) {
        UITouch *touch = touches.anyObject;
        CGPoint location = [touch locationInView:self];
        
        _onClick(@{
            @"position": @[@(location.x), @(location.y)],
            @"source": @"touch"
        });
    }
}

#pragma mark - Public Methods

- (SCNNode *)getPolygonNode
{
    return _polygonNode;
}

- (SCNGeometry *)getPolygonGeometry
{
    return _polygonGeometry;
}

- (NSArray<SCNMaterial *> *)getPolygonMaterials
{
    return _polygonMaterials;
}

- (void)forceUpdate
{
    _geometryDirty = YES;
    _needsRetessellation = YES;
    [self updateGeometry];
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroPolygonComponentView] Deallocating");
    
    // Clean up ViroReact resources
    _vroGeometry = nullptr;
    _vroNode = nullptr;
    _vroGeometrySource = nullptr;
}

@end