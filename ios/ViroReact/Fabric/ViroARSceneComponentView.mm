//
//  ViroARSceneComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARSceneComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARSceneComponentView ()

// ViroReact AR Integration
@property (nonatomic, strong) std::shared_ptr<VROARScene> vroARScene;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroRootNode;
@property (nonatomic, strong) std::shared_ptr<VROARAnchorManager> vroAnchorManager;

// AR Scene Configuration
@property (nonatomic, assign) BOOL trackingEnabled;
@property (nonatomic, assign) BOOL planeDetectionEnabled;
@property (nonatomic, assign) BOOL imageTrackingEnabled;
@property (nonatomic, assign) BOOL objectTrackingEnabled;
@property (nonatomic, assign) BOOL faceTrackingEnabled;

// AR Scene Properties
@property (nonatomic, strong) NSArray *referenceImages;
@property (nonatomic, strong) NSArray *referenceObjects;
@property (nonatomic, strong) NSDictionary *anchorDetectionTypes;

@end

@implementation ViroARSceneComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARSceneComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARSceneComponentView] Initializing AR Scene");
        
        // Initialize default AR scene configuration
        _trackingEnabled = YES;
        _planeDetectionEnabled = YES;
        _imageTrackingEnabled = NO;
        _objectTrackingEnabled = NO;
        _faceTrackingEnabled = NO;
        
        [self setupARScene];
        [self initializeViroReactARScene];
    }
    return self;
}

- (void)setupARScene
{
    RCTLogInfo(@"[ViroARSceneComponentView] Setting up AR scene configuration");
    
    // Configure anchor detection types
    NSMutableDictionary *detectionTypes = [NSMutableDictionary dictionary];
    if (_planeDetectionEnabled) {
        detectionTypes[@"planes"] = @YES;
    }
    if (_imageTrackingEnabled) {
        detectionTypes[@"images"] = @YES;
    }
    if (_objectTrackingEnabled) {
        detectionTypes[@"objects"] = @YES;
    }
    if (_faceTrackingEnabled) {
        detectionTypes[@"faces"] = @YES;
    }
    
    _anchorDetectionTypes = [detectionTypes copy];
    
    RCTLogInfo(@"[ViroARSceneComponentView] AR scene configuration completed");
}

- (void)initializeViroReactARScene
{
    RCTLogInfo(@"[ViroARSceneComponentView] Initializing ViroReact AR scene");
    
    // Create ViroReact AR scene
    _vroARScene = VROARScene::create();
    
    // Create root node for AR content
    _vroRootNode = std::make_shared<VRONode>();
    _vroARScene->setRootNode(_vroRootNode);
    
    // Create AR anchor manager
    _vroAnchorManager = VROARAnchorManager::create();
    _vroARScene->setAnchorManager(_vroAnchorManager);
    
    // Configure AR scene properties
    _vroARScene->setTrackingEnabled(_trackingEnabled);
    _vroARScene->setPlaneDetectionEnabled(_planeDetectionEnabled);
    _vroARScene->setImageTrackingEnabled(_imageTrackingEnabled);
    _vroARScene->setObjectTrackingEnabled(_objectTrackingEnabled);
    _vroARScene->setFaceTrackingEnabled(_faceTrackingEnabled);
    
    // Set default AR scene background
    _vroARScene->setBackgroundType(VROBackgroundType::Camera);
    
    RCTLogInfo(@"[ViroARSceneComponentView] ViroReact AR scene initialized successfully");
}

#pragma mark - AR Configuration Methods

- (void)setTrackingEnabled:(BOOL)trackingEnabled
{
    _trackingEnabled = trackingEnabled;
    if (_vroARScene) {
        _vroARScene->setTrackingEnabled(trackingEnabled);
    }
}

- (void)setPlaneDetectionEnabled:(BOOL)planeDetectionEnabled
{
    _planeDetectionEnabled = planeDetectionEnabled;
    if (_vroARScene) {
        _vroARScene->setPlaneDetectionEnabled(planeDetectionEnabled);
    }
}

- (void)setImageTrackingEnabled:(BOOL)imageTrackingEnabled
{
    _imageTrackingEnabled = imageTrackingEnabled;
    if (_vroARScene) {
        _vroARScene->setImageTrackingEnabled(imageTrackingEnabled);
    }
}

- (void)setObjectTrackingEnabled:(BOOL)objectTrackingEnabled
{
    _objectTrackingEnabled = objectTrackingEnabled;
    if (_vroARScene) {
        _vroARScene->setObjectTrackingEnabled(objectTrackingEnabled);
    }
}

- (void)setFaceTrackingEnabled:(BOOL)faceTrackingEnabled
{
    _faceTrackingEnabled = faceTrackingEnabled;
    if (_vroARScene) {
        _vroARScene->setFaceTrackingEnabled(faceTrackingEnabled);
    }
}

- (void)setReferenceImages:(NSArray *)referenceImages
{
    _referenceImages = referenceImages;
    
    if (_vroARScene && referenceImages.count > 0) {
        // Configure reference images for image tracking
        std::vector<std::shared_ptr<VROARImageTarget>> imageTargets;
        
        for (NSDictionary *imageInfo in referenceImages) {
            NSString *imageName = imageInfo[@"name"];
            NSString *imagePath = imageInfo[@"source"];
            NSNumber *physicalWidth = imageInfo[@"physicalWidth"];
            
            if (imageName && imagePath) {
                auto imageTarget = VROARImageTarget::create(imageName, imagePath, [physicalWidth floatValue]);
                imageTargets.push_back(imageTarget);
            }
        }
        
        _vroARScene->setReferenceImages(imageTargets);
        RCTLogInfo(@"[ViroARSceneComponentView] Set %lu reference images", (unsigned long)imageTargets.size());
    }
}

- (void)setReferenceObjects:(NSArray *)referenceObjects
{
    _referenceObjects = referenceObjects;
    
    if (_vroARScene && referenceObjects.count > 0) {
        // Configure reference objects for object tracking
        std::vector<std::shared_ptr<VROARObjectTarget>> objectTargets;
        
        for (NSDictionary *objectInfo in referenceObjects) {
            NSString *objectName = objectInfo[@"name"];
            NSString *objectPath = objectInfo[@"source"];
            
            if (objectName && objectPath) {
                auto objectTarget = VROARObjectTarget::create(objectName, objectPath);
                objectTargets.push_back(objectTarget);
            }
        }
        
        _vroARScene->setReferenceObjects(objectTargets);
        RCTLogInfo(@"[ViroARSceneComponentView] Set %lu reference objects", (unsigned long)objectTargets.size());
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARSceneComponentView] Deallocating");
    
    // Clean up ViroReact AR resources
    _vroARScene = nullptr;
    _vroRootNode = nullptr;
    _vroAnchorManager = nullptr;
}

@end