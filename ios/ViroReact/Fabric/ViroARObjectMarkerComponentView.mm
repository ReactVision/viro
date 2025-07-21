//
//  ViroARObjectMarkerComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARObjectMarkerComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARObjectMarkerComponentView ()

// ViroReact AR Object Marker Integration
@property (nonatomic, strong) std::shared_ptr<VROARObjectMarker> vroARObjectMarker;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroMarkerNode;
@property (nonatomic, strong) std::shared_ptr<VROARObjectTarget> vroObjectTarget;
@property (nonatomic, strong) std::shared_ptr<VROObjectAnchor> vroObjectAnchor;

// Object Marker Configuration
@property (nonatomic, strong) NSString *source;
@property (nonatomic, strong) NSString *target;
@property (nonatomic, assign) BOOL trackingEnabled;

// Object Detection Properties
@property (nonatomic, assign) BOOL pauseUpdates;
@property (nonatomic, assign) BOOL resetOnDetection;
@property (nonatomic, assign) CGFloat minDetectionDistance;
@property (nonatomic, assign) CGFloat maxDetectionDistance;

// Tracking State
@property (nonatomic, assign) BOOL isTracking;
@property (nonatomic, assign) BOOL isVisible;
@property (nonatomic, strong) NSDate *lastDetectionTime;

// Event Blocks
@property (nonatomic, copy) RCTBubblingEventBlock onAnchorFound;
@property (nonatomic, copy) RCTBubblingEventBlock onAnchorUpdated;
@property (nonatomic, copy) RCTBubblingEventBlock onAnchorRemoved;

@end

@implementation ViroARObjectMarkerComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARObjectMarkerComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARObjectMarkerComponentView] Initializing AR Object Marker");
        
        // Initialize default AR object marker configuration
        _trackingEnabled = YES;
        _pauseUpdates = NO;
        _resetOnDetection = NO;
        _minDetectionDistance = 0.1f;
        _maxDetectionDistance = 10.0f;
        _isTracking = NO;
        _isVisible = NO;
        
        [self initializeViroReactARObjectMarker];
    }
    return self;
}

- (void)initializeViroReactARObjectMarker
{
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Initializing ViroReact AR object marker");
    
    // Create ViroReact AR object marker
    _vroARObjectMarker = VROARObjectMarker::create();
    
    // Create marker node for attaching content
    _vroMarkerNode = std::make_shared<VRONode>();
    
    // Configure AR object marker properties
    _vroARObjectMarker->setTrackingEnabled(_trackingEnabled);
    _vroARObjectMarker->setPauseUpdates(_pauseUpdates);
    _vroARObjectMarker->setResetOnDetection(_resetOnDetection);
    _vroARObjectMarker->setDetectionRange(_minDetectionDistance, _maxDetectionDistance);
    
    // Set initial visibility
    _vroMarkerNode->setVisible(false);
    
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] ViroReact AR object marker initialized successfully");
}

#pragma mark - Object Marker Configuration Methods

- (void)setSource:(NSString *)source
{
    _source = source;
    [self updateObjectTarget];
}

- (void)setTarget:(NSString *)target
{
    _target = target;
    [self updateObjectTarget];
}

- (void)updateObjectTarget
{
    if (!_source || _source.length == 0) {
        return;
    }
    
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Updating object target: %@", _source);
    
    // Create VROARObjectTarget with object source
    NSString *targetName = _target ?: _source;
    _vroObjectTarget = VROARObjectTarget::create(targetName, _source);
    
    // Apply target to AR object marker
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setObjectTarget(_vroObjectTarget);
    }
    
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Object target updated: %@", targetName);
}

- (void)setTrackingEnabled:(BOOL)trackingEnabled
{
    _trackingEnabled = trackingEnabled;
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setTrackingEnabled(trackingEnabled);
    }
}

- (void)setPauseUpdates:(BOOL)pauseUpdates
{
    _pauseUpdates = pauseUpdates;
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setPauseUpdates(pauseUpdates);
    }
}

- (void)setResetOnDetection:(BOOL)resetOnDetection
{
    _resetOnDetection = resetOnDetection;
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setResetOnDetection(resetOnDetection);
    }
}

- (void)setMinDetectionDistance:(CGFloat)minDetectionDistance
{
    _minDetectionDistance = minDetectionDistance;
    [self updateDetectionRange];
}

- (void)setMaxDetectionDistance:(CGFloat)maxDetectionDistance
{
    _maxDetectionDistance = maxDetectionDistance;
    [self updateDetectionRange];
}

- (void)updateDetectionRange
{
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setDetectionRange(_minDetectionDistance, _maxDetectionDistance);
    }
}

#pragma mark - Object Anchor Management

- (void)attachToObjectAnchor:(ARObjectAnchor *)objectAnchor
{
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Attaching to object anchor: %@", objectAnchor.referenceObject.name);
    
    if (_vroARObjectMarker) {
        // Create VROObjectAnchor from ARObjectAnchor
        _vroObjectAnchor = VROObjectAnchor::createFromARObjectAnchor(objectAnchor);
        _vroARObjectMarker->setObjectAnchor(_vroObjectAnchor);
        
        // Update marker position and state
        [self updateMarkerFromAnchor:objectAnchor];
        
        // Mark as tracking and visible
        _isTracking = YES;
        _isVisible = YES;
        _lastDetectionTime = [NSDate date];
        
        // Show marker node
        _vroMarkerNode->setVisible(true);
        
        // Fire onAnchorFound event
        if (_onAnchorFound) {
            _onAnchorFound(@{
                @"target": objectAnchor.referenceObject.name ?: @"unknown",
                @"position": [self positionArrayFromAnchor:objectAnchor],
                @"rotation": [self rotationArrayFromAnchor:objectAnchor]
            });
        }
    }
}

- (void)updateMarkerFromAnchor:(ARObjectAnchor *)objectAnchor
{
    if (!objectAnchor || !_vroMarkerNode) {
        return;
    }
    
    // Update marker position and rotation from anchor
    simd_float4x4 transform = objectAnchor.transform;
    
    // Extract position
    VROVector3f position(transform.columns[3].x, transform.columns[3].y, transform.columns[3].z);
    _vroMarkerNode->setPosition(position);
    
    // Extract rotation (convert from transform matrix to Euler angles)
    VROMatrix4f vroTransform = VROMatrix4f(transform);
    VROVector3f rotation = vroTransform.extractRotation();
    _vroMarkerNode->setRotation(rotation);
    
    // Update tracking state
    _lastDetectionTime = [NSDate date];
    
    // Fire onAnchorUpdated event
    if (_onAnchorUpdated) {
        _onAnchorUpdated(@{
            @"target": objectAnchor.referenceObject.name ?: @"unknown",
            @"position": [self positionArrayFromAnchor:objectAnchor],
            @"rotation": [self rotationArrayFromAnchor:objectAnchor]
        });
    }
}

- (void)removeObjectAnchor
{
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Removing object anchor");
    
    // Mark as not tracking
    _isTracking = NO;
    _isVisible = NO;
    
    // Hide marker node
    if (_vroMarkerNode) {
        _vroMarkerNode->setVisible(false);
    }
    
    // Clear anchor
    if (_vroARObjectMarker) {
        _vroARObjectMarker->setObjectAnchor(nullptr);
    }
    _vroObjectAnchor = nullptr;
    
    // Fire onAnchorRemoved event
    if (_onAnchorRemoved) {
        NSString *targetName = _target ?: _source ?: @"unknown";
        _onAnchorRemoved(@{
            @"target": targetName
        });
    }
}

#pragma mark - Helper Methods

- (NSArray<NSNumber *> *)positionArrayFromAnchor:(ARObjectAnchor *)anchor
{
    simd_float4x4 transform = anchor.transform;
    return @[
        @(transform.columns[3].x),
        @(transform.columns[3].y),
        @(transform.columns[3].z)
    ];
}

- (NSArray<NSNumber *> *)rotationArrayFromAnchor:(ARObjectAnchor *)anchor
{
    simd_float4x4 transform = anchor.transform;
    VROMatrix4f vroTransform = VROMatrix4f(transform);
    VROVector3f rotation = vroTransform.extractRotation();
    
    return @[
        @(rotation.x * 180.0 / M_PI),
        @(rotation.y * 180.0 / M_PI),
        @(rotation.z * 180.0 / M_PI)
    ];
}

#pragma mark - Event Setters

- (void)setOnAnchorFound:(RCTBubblingEventBlock)onAnchorFound
{
    _onAnchorFound = onAnchorFound;
}

- (void)setOnAnchorUpdated:(RCTBubblingEventBlock)onAnchorUpdated
{
    _onAnchorUpdated = onAnchorUpdated;
}

- (void)setOnAnchorRemoved:(RCTBubblingEventBlock)onAnchorRemoved
{
    _onAnchorRemoved = onAnchorRemoved;
}

#pragma mark - Public Methods

- (BOOL)isObjectMarkerTracking
{
    return _isTracking;
}

- (NSTimeInterval)timeSinceLastDetection
{
    if (!_lastDetectionTime) {
        return -1.0;
    }
    return [[NSDate date] timeIntervalSinceDate:_lastDetectionTime];
}

- (void)resetTracking
{
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Resetting object marker tracking");
    
    [self removeObjectAnchor];
    
    if (_vroARObjectMarker) {
        _vroARObjectMarker->resetTracking();
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARObjectMarkerComponentView] Deallocating");
    
    // Clean up ViroReact AR object marker resources
    _vroARObjectMarker = nullptr;
    _vroMarkerNode = nullptr;
    _vroObjectTarget = nullptr;
    _vroObjectAnchor = nullptr;
}

@end