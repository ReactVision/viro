//
//  ViroPolylineComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroPolylineComponentView.h"
#import <React/RCTAssert.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <SceneKit/SceneKit.h>

@interface ViroPolylineComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROGeometry> vroGeometry;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;
@property (nonatomic, strong) std::shared_ptr<VROGeometrySource> vroGeometrySource;

// SceneKit components
@property (nonatomic, strong) SCNNode *polylineNode;
@property (nonatomic, strong) SCNGeometry *polylineGeometry;
@property (nonatomic, strong) NSMutableArray<SCNMaterial *> *polylineMaterials;

// Geometry data
@property (nonatomic, strong) NSMutableArray<NSValue *> *processedPoints;
@property (nonatomic, strong) NSMutableArray<NSValue *> *lineVertices;
@property (nonatomic, strong) NSMutableArray<NSNumber *> *lineIndices;
@property (nonatomic, strong) NSMutableArray<NSValue *> *lineNormals;
@property (nonatomic, strong) NSMutableArray<NSValue *> *lineUVs;

// Line generation state
@property (nonatomic, assign) BOOL geometryDirty;
@property (nonatomic, assign) BOOL stylesDirty;
@property (nonatomic, assign) CGFloat totalLength;

@end

@implementation ViroPolylineComponentView

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroPolylineComponentDescriptor>();
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
    _points = @[];
    _thickness = 0.01f;
    _colors = @[];
    _closed = NO;
    _lineType = @"solid";
    _dashLength = 0.1f;
    _gapLength = 0.05f;
    _capType = @"round";
    _joinType = @"round";
    _segments = 10;
    _smooth = NO;
    _smoothness = 0.5f;
    _materials = @[];
    
    // Initialize collections
    _processedPoints = [NSMutableArray array];
    _lineVertices = [NSMutableArray array];
    _lineIndices = [NSMutableArray array];
    _lineNormals = [NSMutableArray array];
    _lineUVs = [NSMutableArray array];
    _polylineMaterials = [NSMutableArray array];
    
    // Initialize state
    _geometryDirty = YES;
    _stylesDirty = YES;
    _totalLength = 0.0f;
    
    // Initialize ViroReact polyline
    [self initializeVROPolyline];
    
    // Setup SceneKit components
    [self setupSceneKitComponents];
}

- (void)setupSceneKitComponents
{
    _polylineNode = [SCNNode node];
    _polylineNode.name = @"ViroPolyline";
    
    // Create initial geometry
    [self updateGeometry];
}

#pragma mark - ViroReact Integration

- (void)initializeVROPolyline
{
    RCTLogInfo(@"[ViroPolylineComponentView] Creating VROGeometry");
    
    // Create VROGeometry for polyline
    _vroGeometry = VROGeometry::create();
    
    // Create VRONode to hold the polyline
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroGeometry);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    RCTLogInfo(@"[ViroPolylineComponentView] VROGeometry created successfully");
}

- (void)updateVROPolyline
{
    if (!_vroGeometry || _points.count < 2) {
        return;
    }
    
    RCTLogInfo(@"[ViroPolylineComponentView] Updating VROPolyline with %lu points", (unsigned long)_points.count);
    
    // Build polyline geometry from points
    [self buildPolylineVROGeometry];
}

- (void)buildPolylineVROGeometry
{
    if (_points.count < 2) {
        RCTLogWarn(@"[ViroPolylineComponentView] Need at least 2 points for polyline");
        return;
    }
    
    // Convert line vertices to ViroKit format
    std::vector<VROVector3f> vertices;
    for (NSValue *vertexValue in _lineVertices) {
        SCNVector3 vertex = [vertexValue SCNVector3Value];
        vertices.push_back(VROVector3f(vertex.x, vertex.y, vertex.z));
    }
    
    // Convert line indices to ViroKit format
    std::vector<int> indices;
    for (NSNumber *indexNumber in _lineIndices) {
        indices.push_back([indexNumber intValue]);
    }
    
    // Generate normals for line segments
    std::vector<VROVector3f> normals;
    for (NSValue *normalValue in _lineNormals) {
        SCNVector3 normal = [normalValue SCNVector3Value];
        normals.push_back(VROVector3f(normal.x, normal.y, normal.z));
    }
    
    // Generate UV coordinates for line segments
    std::vector<VROVector3f> texcoords;
    for (NSValue *uvValue in _lineUVs) {
        CGPoint uv = [uvValue CGPointValue];
        texcoords.push_back(VROVector3f(uv.x, uv.y, 0.0f));
    }
    
    // Create VROGeometrySource and apply to geometry
    _vroGeometrySource = VROGeometrySource::create(vertices, normals, texcoords, indices);
    _vroGeometry->setGeometrySources({ _vroGeometrySource });
}

#pragma mark - Property Setters

- (void)setPoints:(NSArray<NSArray<NSNumber *> *> *)points
{
    _points = points;
    _geometryDirty = YES;
    [self updateGeometry];
    
    // Update ViroReact geometry
    [self updateVROPolyline];
}

- (void)setThickness:(CGFloat)thickness
{
    _thickness = thickness;
    _geometryDirty = YES;
    [self updateGeometry];
    
    // Update ViroReact geometry
    [self updateVROPolyline];
}

- (void)setColors:(NSArray<NSNumber *> *)colors
{
    _colors = colors;
    _stylesDirty = YES;
    [self applyLineStyle];
}

- (void)setClosed:(BOOL)closed
{
    _closed = closed;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setLineType:(NSString *)lineType
{
    _lineType = lineType;
    _stylesDirty = YES;
    [self applyLineStyle];
}

- (void)setDashLength:(CGFloat)dashLength
{
    _dashLength = dashLength;
    _stylesDirty = YES;
    [self applyLineStyle];
}

- (void)setGapLength:(CGFloat)gapLength
{
    _gapLength = gapLength;
    _stylesDirty = YES;
    [self applyLineStyle];
}

- (void)setCapType:(NSString *)capType
{
    _capType = capType;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setJoinType:(NSString *)joinType
{
    _joinType = joinType;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setSegments:(NSInteger)segments
{
    _segments = segments;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setSmooth:(BOOL)smooth
{
    _smooth = smooth;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setSmoothness:(CGFloat)smoothness
{
    _smoothness = smoothness;
    _geometryDirty = YES;
    [self updateGeometry];
}

- (void)setMaterials:(NSArray<NSString *> *)materials
{
    _materials = materials;
    _stylesDirty = YES;
    [self applyLineStyle];
}

#pragma mark - Geometry Generation

- (void)updateGeometry
{
    if (!_geometryDirty) return;
    
    // Process points
    [self processPoints];
    
    // Generate line geometry
    [self generateLineGeometry];
    
    // Create SceneKit geometry
    [self createSceneKitGeometry];
    
    // Apply line styles
    [self applyLineStyle];
    
    // Update ViroReact geometry after SceneKit generation
    [self updateVROPolyline];
    
    _geometryDirty = NO;
}

- (void)processPoints
{
    [_processedPoints removeAllObjects];
    _totalLength = 0.0f;
    
    // Process input points
    for (NSArray<NSNumber *> *point in _points) {
        if (point.count >= 2) {
            float x = [point[0] floatValue];
            float y = [point[1] floatValue];
            float z = point.count > 2 ? [point[2] floatValue] : 0.0f;
            
            SCNVector3 position = SCNVector3Make(x, y, z);
            [_processedPoints addObject:[NSValue valueWithSCNVector3:position]];
        }
    }
    
    // Calculate total length
    for (NSInteger i = 1; i < _processedPoints.count; i++) {
        SCNVector3 p1 = [_processedPoints[i-1] SCNVector3Value];
        SCNVector3 p2 = [_processedPoints[i] SCNVector3Value];
        
        float segmentLength = sqrt(
            (p2.x - p1.x) * (p2.x - p1.x) +
            (p2.y - p1.y) * (p2.y - p1.y) +
            (p2.z - p1.z) * (p2.z - p1.z)
        );
        
        _totalLength += segmentLength;
    }
    
    // Apply smoothing if enabled
    if (_smooth && _processedPoints.count > 2) {
        [self applySmoothingToPoints];
    }
}

- (void)applySmoothingToPoints
{
    if (_processedPoints.count < 3) return;
    
    NSMutableArray<NSValue *> *smoothedPoints = [NSMutableArray array];
    
    // Keep first point
    [smoothedPoints addObject:_processedPoints[0]];
    
    // Apply Catmull-Rom spline smoothing
    for (NSInteger i = 1; i < _processedPoints.count - 1; i++) {
        SCNVector3 p0 = i > 1 ? [_processedPoints[i-2] SCNVector3Value] : [_processedPoints[i-1] SCNVector3Value];
        SCNVector3 p1 = [_processedPoints[i-1] SCNVector3Value];
        SCNVector3 p2 = [_processedPoints[i] SCNVector3Value];
        SCNVector3 p3 = i < _processedPoints.count - 2 ? [_processedPoints[i+1] SCNVector3Value] : [_processedPoints[i] SCNVector3Value];
        
        // Generate intermediate points
        for (NSInteger j = 0; j < _segments; j++) {
            float t = (float)j / (float)_segments;
            SCNVector3 interpolated = [self catmullRomInterpolate:p0 p1:p1 p2:p2 p3:p3 t:t];
            [smoothedPoints addObject:[NSValue valueWithSCNVector3:interpolated]];
        }
    }
    
    // Keep last point
    [smoothedPoints addObject:_processedPoints.lastObject];
    
    _processedPoints = smoothedPoints;
}

- (SCNVector3)catmullRomInterpolate:(SCNVector3)p0 p1:(SCNVector3)p1 p2:(SCNVector3)p2 p3:(SCNVector3)p3 t:(float)t
{
    float t2 = t * t;
    float t3 = t2 * t;
    
    float x = 0.5f * (2.0f * p1.x + (-p0.x + p2.x) * t + (2.0f * p0.x - 5.0f * p1.x + 4.0f * p2.x - p3.x) * t2 + (-p0.x + 3.0f * p1.x - 3.0f * p2.x + p3.x) * t3);
    float y = 0.5f * (2.0f * p1.y + (-p0.y + p2.y) * t + (2.0f * p0.y - 5.0f * p1.y + 4.0f * p2.y - p3.y) * t2 + (-p0.y + 3.0f * p1.y - 3.0f * p2.y + p3.y) * t3);
    float z = 0.5f * (2.0f * p1.z + (-p0.z + p2.z) * t + (2.0f * p0.z - 5.0f * p1.z + 4.0f * p2.z - p3.z) * t2 + (-p0.z + 3.0f * p1.z - 3.0f * p2.z + p3.z) * t3);
    
    return SCNVector3Make(x, y, z);
}

- (void)generateLineGeometry
{
    [_lineVertices removeAllObjects];
    [_lineIndices removeAllObjects];
    [_lineNormals removeAllObjects];
    [_lineUVs removeAllObjects];
    
    if (_processedPoints.count < 2) return;
    
    // Generate vertices for line strips with thickness
    for (NSInteger i = 0; i < _processedPoints.count - 1; i++) {
        SCNVector3 p1 = [_processedPoints[i] SCNVector3Value];
        SCNVector3 p2 = [_processedPoints[i + 1] SCNVector3Value];
        
        // Calculate direction and perpendicular vectors
        SCNVector3 direction = SCNVector3Make(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        float length = sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        
        if (length > 0) {
            direction.x /= length;
            direction.y /= length;
            direction.z /= length;
        }
        
        // Calculate perpendicular vector (assuming Y is up)
        SCNVector3 up = SCNVector3Make(0, 1, 0);
        SCNVector3 right = SCNVector3Make(
            direction.y * up.z - direction.z * up.y,
            direction.z * up.x - direction.x * up.z,
            direction.x * up.y - direction.y * up.x
        );
        
        float rightLength = sqrt(right.x * right.x + right.y * right.y + right.z * right.z);
        if (rightLength > 0) {
            right.x /= rightLength;
            right.y /= rightLength;
            right.z /= rightLength;
        }
        
        // Generate quad vertices for line segment
        float halfThickness = _thickness * 0.5f;
        
        SCNVector3 v1 = SCNVector3Make(p1.x + right.x * halfThickness, p1.y + right.y * halfThickness, p1.z + right.z * halfThickness);
        SCNVector3 v2 = SCNVector3Make(p1.x - right.x * halfThickness, p1.y - right.y * halfThickness, p1.z - right.z * halfThickness);
        SCNVector3 v3 = SCNVector3Make(p2.x - right.x * halfThickness, p2.y - right.y * halfThickness, p2.z - right.z * halfThickness);
        SCNVector3 v4 = SCNVector3Make(p2.x + right.x * halfThickness, p2.y + right.y * halfThickness, p2.z + right.z * halfThickness);
        
        NSUInteger baseIndex = _lineVertices.count;
        
        // Add vertices
        [_lineVertices addObject:[NSValue valueWithSCNVector3:v1]];
        [_lineVertices addObject:[NSValue valueWithSCNVector3:v2]];
        [_lineVertices addObject:[NSValue valueWithSCNVector3:v3]];
        [_lineVertices addObject:[NSValue valueWithSCNVector3:v4]];
        
        // Add normals (pointing towards camera)
        SCNVector3 normal = SCNVector3Make(0, 0, 1);
        [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
        [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
        [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
        [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
        
        // Add UV coordinates
        float u1 = (float)i / (float)(_processedPoints.count - 1);
        float u2 = (float)(i + 1) / (float)(_processedPoints.count - 1);
        
        [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(u1, 0)]];
        [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(u1, 1)]];
        [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(u2, 1)]];
        [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(u2, 0)]];
        
        // Add triangle indices
        [_lineIndices addObject:@(baseIndex)];
        [_lineIndices addObject:@(baseIndex + 1)];
        [_lineIndices addObject:@(baseIndex + 2)];
        
        [_lineIndices addObject:@(baseIndex)];
        [_lineIndices addObject:@(baseIndex + 2)];
        [_lineIndices addObject:@(baseIndex + 3)];
    }
    
    // Handle closed polylines
    if (_closed && _processedPoints.count > 2) {
        [self generateClosingSegment];
    }
}

- (void)generateClosingSegment
{
    SCNVector3 lastPoint = [_processedPoints.lastObject SCNVector3Value];
    SCNVector3 firstPoint = [_processedPoints.firstObject SCNVector3Value];
    
    // Calculate direction and perpendicular vectors
    SCNVector3 direction = SCNVector3Make(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y, firstPoint.z - lastPoint.z);
    float length = sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    
    if (length > 0) {
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;
    }
    
    // Calculate perpendicular vector
    SCNVector3 up = SCNVector3Make(0, 1, 0);
    SCNVector3 right = SCNVector3Make(
        direction.y * up.z - direction.z * up.y,
        direction.z * up.x - direction.x * up.z,
        direction.x * up.y - direction.y * up.x
    );
    
    float rightLength = sqrt(right.x * right.x + right.y * right.y + right.z * right.z);
    if (rightLength > 0) {
        right.x /= rightLength;
        right.y /= rightLength;
        right.z /= rightLength;
    }
    
    // Generate closing quad
    float halfThickness = _thickness * 0.5f;
    
    SCNVector3 v1 = SCNVector3Make(lastPoint.x + right.x * halfThickness, lastPoint.y + right.y * halfThickness, lastPoint.z + right.z * halfThickness);
    SCNVector3 v2 = SCNVector3Make(lastPoint.x - right.x * halfThickness, lastPoint.y - right.y * halfThickness, lastPoint.z - right.z * halfThickness);
    SCNVector3 v3 = SCNVector3Make(firstPoint.x - right.x * halfThickness, firstPoint.y - right.y * halfThickness, firstPoint.z - right.z * halfThickness);
    SCNVector3 v4 = SCNVector3Make(firstPoint.x + right.x * halfThickness, firstPoint.y + right.y * halfThickness, firstPoint.z + right.z * halfThickness);
    
    NSUInteger baseIndex = _lineVertices.count;
    
    // Add vertices
    [_lineVertices addObject:[NSValue valueWithSCNVector3:v1]];
    [_lineVertices addObject:[NSValue valueWithSCNVector3:v2]];
    [_lineVertices addObject:[NSValue valueWithSCNVector3:v3]];
    [_lineVertices addObject:[NSValue valueWithSCNVector3:v4]];
    
    // Add normals
    SCNVector3 normal = SCNVector3Make(0, 0, 1);
    [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
    [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
    [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
    [_lineNormals addObject:[NSValue valueWithSCNVector3:normal]];
    
    // Add UV coordinates
    [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(1, 0)]];
    [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(1, 1)]];
    [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(0, 1)]];
    [_lineUVs addObject:[NSValue valueWithCGPoint:CGPointMake(0, 0)]];
    
    // Add triangle indices
    [_lineIndices addObject:@(baseIndex)];
    [_lineIndices addObject:@(baseIndex + 1)];
    [_lineIndices addObject:@(baseIndex + 2)];
    
    [_lineIndices addObject:@(baseIndex)];
    [_lineIndices addObject:@(baseIndex + 2)];
    [_lineIndices addObject:@(baseIndex + 3)];
}

- (void)createSceneKitGeometry
{
    if (_lineVertices.count == 0 || _lineIndices.count == 0) {
        return;
    }
    
    // Create SCNGeometry
    SCNGeometrySource *vertexSource = [SCNGeometrySource geometrySourceWithVertices:(SCNVector3 *)[_lineVertices.firstObject pointerValue] count:_lineVertices.count];
    SCNGeometrySource *normalSource = [SCNGeometrySource geometrySourceWithNormals:(SCNVector3 *)[_lineNormals.firstObject pointerValue] count:_lineNormals.count];
    SCNGeometrySource *uvSource = [SCNGeometrySource geometrySourceWithTextureCoordinates:(CGPoint *)[_lineUVs.firstObject pointerValue] count:_lineUVs.count];
    
    // Create triangle data
    NSData *indexData = [NSData dataWithBytes:_lineIndices.firstObject length:_lineIndices.count * sizeof(uint32_t)];
    SCNGeometryElement *element = [SCNGeometryElement geometryElementWithData:indexData
                                                                primitiveType:SCNGeometryPrimitiveTypeTriangles
                                                               primitiveCount:_lineIndices.count / 3
                                                                bytesPerIndex:sizeof(uint32_t)];
    
    _polylineGeometry = [SCNGeometry geometryWithSources:@[vertexSource, normalSource, uvSource] elements:@[element]];
    
    // Assign geometry to node
    _polylineNode.geometry = _polylineGeometry;
}

- (void)applyLineStyle
{
    if (!_stylesDirty) return;
    
    [_polylineMaterials removeAllObjects];
    
    if (_materials.count == 0) {
        // Create default material
        SCNMaterial *material = [SCNMaterial material];
        material.diffuse.contents = [UIColor whiteColor];
        material.lightingModelName = SCNLightingModelLambert;
        
        // Apply line type styling
        if ([_lineType isEqualToString:@"dashed"]) {
            // Create dashed pattern texture
            [self createDashedTexture:material];
        }
        
        [_polylineMaterials addObject:material];
    } else {
        // Create materials from material names
        for (NSString *materialName in _materials) {
            SCNMaterial *material = [SCNMaterial material];
            material.name = materialName;
            material.lightingModelName = SCNLightingModelLambert;
            [_polylineMaterials addObject:material];
        }
    }
    
    // Apply colors if provided
    if (_colors.count >= 3) {
        SCNMaterial *material = _polylineMaterials.firstObject;
        float r = [_colors[0] floatValue];
        float g = [_colors[1] floatValue];
        float b = [_colors[2] floatValue];
        float a = _colors.count > 3 ? [_colors[3] floatValue] : 1.0f;
        
        material.diffuse.contents = [UIColor colorWithRed:r green:g blue:b alpha:a];
    }
    
    _polylineGeometry.materials = _polylineMaterials;
    _stylesDirty = NO;
}

- (void)createDashedTexture:(SCNMaterial *)material
{
    // Create a simple dashed pattern texture
    NSInteger width = 64;
    NSInteger height = 4;
    NSInteger dashPixels = (NSInteger)(_dashLength * width);
    NSInteger gapPixels = (NSInteger)(_gapLength * width);
    
    NSMutableData *pixelData = [NSMutableData dataWithLength:width * height * 4];
    unsigned char *pixels = (unsigned char *)pixelData.mutableBytes;
    
    for (NSInteger y = 0; y < height; y++) {
        for (NSInteger x = 0; x < width; x++) {
            NSInteger index = (y * width + x) * 4;
            
            // Create dash pattern
            NSInteger position = x % (dashPixels + gapPixels);
            unsigned char alpha = position < dashPixels ? 255 : 0;
            
            pixels[index] = 255;     // R
            pixels[index + 1] = 255; // G
            pixels[index + 2] = 255; // B
            pixels[index + 3] = alpha; // A
        }
    }
    
    // Create texture from pixel data
    NSData *textureData = [NSData dataWithData:pixelData];
    UIImage *dashImage = [UIImage imageWithData:textureData];
    
    if (dashImage) {
        material.diffuse.contents = dashImage;
        material.diffuse.wrapS = SCNWrapModeRepeat;
        material.diffuse.wrapT = SCNWrapModeRepeat;
    }
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

- (SCNNode *)getPolylineNode
{
    return _polylineNode;
}

- (SCNGeometry *)getPolylineGeometry
{
    return _polylineGeometry;
}

- (NSArray<SCNMaterial *> *)getPolylineMaterials
{
    return _polylineMaterials;
}

- (CGFloat)getTotalLength
{
    return _totalLength;
}

- (void)forceUpdate
{
    _geometryDirty = YES;
    _stylesDirty = YES;
    [self updateGeometry];
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroPolylineComponentView] Deallocating");
    
    // Clean up ViroReact resources
    _vroGeometry = nullptr;
    _vroNode = nullptr;
    _vroGeometrySource = nullptr;
}

@end