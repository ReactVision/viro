//
//  ViroARImageMarkerComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARImageMarkerComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARImageMarkerComponentView ()

// ViroReact AR Image Marker Integration
@property (nonatomic, strong) std::shared_ptr<VROARImageMarker> vroARImageMarker;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroMarkerNode;
@property (nonatomic, strong) std::shared_ptr<VROARImageTarget> vroImageTarget;
@property (nonatomic, strong) std::shared_ptr<VROImageAnchor> vroImageAnchor;

// Image Marker Configuration
@property (nonatomic, strong) NSString *source;
@property (nonatomic, assign) CGFloat physicalWidth;
@property (nonatomic, assign) CGFloat physicalHeight;
@property (nonatomic, strong) NSString *target;
@property (nonatomic, assign) BOOL trackingEnabled;

// Marker Detection Properties
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

@implementation ViroARImageMarkerComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARImageMarkerComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARImageMarkerComponentView] Initializing AR Image Marker");
        
        // Initialize default AR image marker configuration
        _physicalWidth = 0.1f; // 10cm default
        _physicalHeight = 0.1f; // 10cm default
        _trackingEnabled = YES;
        _pauseUpdates = NO;
        _resetOnDetection = NO;
        _minDetectionDistance = 0.1f;
        _maxDetectionDistance = 10.0f;
        _isTracking = NO;
        _isVisible = NO;
        
        [self initializeViroReactARImageMarker];
    }
    return self;
}

- (void)initializeViroReactARImageMarker
{
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Initializing ViroReact AR image marker");
    
    // Create ViroReact AR image marker
    _vroARImageMarker = VROARImageMarker::create();
    
    // Create marker node for attaching content
    _vroMarkerNode = std::make_shared<VRONode>();
    
    // Configure AR image marker properties
    _vroARImageMarker->setTrackingEnabled(_trackingEnabled);
    _vroARImageMarker->setPauseUpdates(_pauseUpdates);
    _vroARImageMarker->setResetOnDetection(_resetOnDetection);
    _vroARImageMarker->setDetectionRange(_minDetectionDistance, _maxDetectionDistance);
    
    // Set initial visibility
    _vroMarkerNode->setVisible(false);
    
    RCTLogInfo(@"[ViroARImageMarkerComponentView] ViroReact AR image marker initialized successfully");
}

#pragma mark - Image Marker Configuration Methods

- (void)setSource:(NSString *)source
{
    _source = source;
    [self updateImageTarget];
}

- (void)setPhysicalWidth:(CGFloat)physicalWidth
{
    _physicalWidth = physicalWidth;
    [self updateImageTarget];
}

- (void)setPhysicalHeight:(CGFloat)physicalHeight
{
    _physicalHeight = physicalHeight;
    [self updateImageTarget];
}

- (void)setTarget:(NSString *)target
{
    _target = target;
    [self updateImageTarget];
}

- (void)updateImageTarget
{
    if (!_source || _source.length == 0) {
        return;
    }
    
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Updating image target: %@", _source);
    
    // Create VROARImageTarget with image source
    NSString *targetName = _target ?: _source;
    _vroImageTarget = VROARImageTarget::create(targetName, _source, _physicalWidth);
    
    // Set physical dimensions
    _vroImageTarget->setPhysicalSize(VROVector2f(_physicalWidth, _physicalHeight));
    
    // Apply target to AR image marker
    if (_vroARImageMarker) {
        _vroARImageMarker->setImageTarget(_vroImageTarget);
    }
    
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Image target updated: %@ (%.2fx%.2f)", 
               targetName, _physicalWidth, _physicalHeight);
}

- (void)setTrackingEnabled:(BOOL)trackingEnabled
{
    _trackingEnabled = trackingEnabled;
    if (_vroARImageMarker) {
        _vroARImageMarker->setTrackingEnabled(trackingEnabled);
    }
}

- (void)setPauseUpdates:(BOOL)pauseUpdates
{
    _pauseUpdates = pauseUpdates;
    if (_vroARImageMarker) {
        _vroARImageMarker->setPauseUpdates(pauseUpdates);
    }
}

- (void)setResetOnDetection:(BOOL)resetOnDetection
{
    _resetOnDetection = resetOnDetection;
    if (_vroARImageMarker) {
        _vroARImageMarker->setResetOnDetection(resetOnDetection);
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
    if (_vroARImageMarker) {
        _vroARImageMarker->setDetectionRange(_minDetectionDistance, _maxDetectionDistance);
    }
}

#pragma mark - Image Anchor Management

- (void)attachToImageAnchor:(ARImageAnchor *)imageAnchor
{
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Attaching to image anchor: %@", imageAnchor.referenceImage.name);
    
    if (_vroARImageMarker) {
        // Create VROImageAnchor from ARImageAnchor
        _vroImageAnchor = VROImageAnchor::createFromARImageAnchor(imageAnchor);
        _vroARImageMarker->setImageAnchor(_vroImageAnchor);
        
        // Update marker position and state
        [self updateMarkerFromAnchor:imageAnchor];
        
        // Mark as tracking and visible
        _isTracking = YES;
        _isVisible = YES;
        _lastDetectionTime = [NSDate date];
        
        // Show marker node
        _vroMarkerNode->setVisible(true);
        
        // Fire onAnchorFound event
        if (_onAnchorFound) {
            _onAnchorFound(@{
                @"target": imageAnchor.referenceImage.name ?: @"unknown",
                @"position": [self positionArrayFromAnchor:imageAnchor],
                @"rotation": [self rotationArrayFromAnchor:imageAnchor]
            });
        }
    }
}

- (void)updateMarkerFromAnchor:(ARImageAnchor *)imageAnchor
{
    if (!imageAnchor || !_vroMarkerNode) {
        return;
    }
    
    // Update marker position and rotation from anchor
    simd_float4x4 transform = imageAnchor.transform;
    
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
            @"target": imageAnchor.referenceImage.name ?: @"unknown",
            @"position": [self positionArrayFromAnchor:imageAnchor],
            @"rotation": [self rotationArrayFromAnchor:imageAnchor]
        });
    }
}

- (void)removeImageAnchor
{
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Removing image anchor");
    
    // Mark as not tracking
    _isTracking = NO;
    _isVisible = NO;
    
    // Hide marker node
    if (_vroMarkerNode) {
        _vroMarkerNode->setVisible(false);
    }
    
    // Clear anchor
    if (_vroARImageMarker) {
        _vroARImageMarker->setImageAnchor(nullptr);
    }
    _vroImageAnchor = nullptr;
    
    // Fire onAnchorRemoved event
    if (_onAnchorRemoved) {
        NSString *targetName = _target ?: _source ?: @"unknown";
        _onAnchorRemoved(@{
            @"target": targetName
        });
    }
}

#pragma mark - Helper Methods

- (NSArray<NSNumber *> *)positionArrayFromAnchor:(ARImageAnchor *)anchor
{
    simd_float4x4 transform = anchor.transform;
    return @[
        @(transform.columns[3].x),
        @(transform.columns[3].y),
        @(transform.columns[3].z)
    ];
}

- (NSArray<NSNumber *> *)rotationArrayFromAnchor:(ARImageAnchor *)anchor
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

- (BOOL)isImageMarkerTracking
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
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Resetting image marker tracking");
    
    [self removeImageAnchor];
    
    if (_vroARImageMarker) {
        _vroARImageMarker->resetTracking();
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARImageMarkerComponentView] Deallocating");
    
    // Clean up ViroReact AR image marker resources
    _vroARImageMarker = nullptr;
    _vroMarkerNode = nullptr;
    _vroImageTarget = nullptr;
    _vroImageAnchor = nullptr;
}

@end