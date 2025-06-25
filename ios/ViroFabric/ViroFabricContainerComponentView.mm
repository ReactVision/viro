//
//  ViroFabricContainerComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricContainerComponentView.h"
#import "ViroFabricContainer.h"

#import <react/renderer/components/ViroFabricContainerViewComponentDescriptor/ComponentDescriptors.h>
#import <react/renderer/components/ViroFabricContainerViewComponentDescriptor/EventEmitters.h>
#import <react/renderer/components/ViroFabricContainerViewComponentDescriptor/Props.h>
#import <react/renderer/components/ViroFabricContainerViewComponentDescriptor/RCTComponentViewHelpers.h>

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>

using namespace facebook::react;

@interface ViroFabricContainerComponentView () <RCTViroFabricContainerViewViewProtocol>
@end

@implementation ViroFabricContainerComponentView {
    ViroFabricContainer *_viroFabricContainer;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ViroFabricContainerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroFabricContainerViewProps>();
        _props = defaultProps;
        
        // Create the ViroFabricContainer
        _viroFabricContainer = [[ViroFabricContainer alloc] initWithBridge:nil];
        _viroFabricContainer.frame = self.bounds;
        _viroFabricContainer.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        
        // Add the ViroFabricContainer as a subview
        [self addSubview:_viroFabricContainer];
        
        // Set up the event handlers
        __weak __typeof(self) weakSelf = self;
        
        _viroFabricContainer.onInitialized = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onInitialized(RCTBridgingToEventEmitterOnInitialized(event));
            }
        };
        
        _viroFabricContainer.onTrackingUpdated = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onTrackingUpdated(RCTBridgingToEventEmitterOnTrackingUpdated(event));
            }
        };
        
        _viroFabricContainer.onCameraTransformUpdate = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onCameraTransformUpdate(RCTBridgingToEventEmitterOnCameraTransformUpdate(event));
            }
        };
    }
    
    return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<const ViroFabricContainerViewProps>(oldProps ?: _props);
    const auto &newViewProps = *std::static_pointer_cast<const ViroFabricContainerViewProps>(props);
    
    // Update the props
    [super updateProps:props oldProps:oldProps];
}

#pragma mark - Native Commands

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    RCTViroFabricContainerViewHandleCommand(self, commandName, args);
}

- (void)initialize:(NSString *)apiKey debug:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment
{
    [_viroFabricContainer initialize:apiKey debug:debug arEnabled:arEnabled worldAlignment:worldAlignment];
}

- (void)cleanup
{
    [_viroFabricContainer cleanup];
}

@end

// Register the component with React Native
Class<RCTComponentViewProtocol> ViroFabricContainerViewCls(void)
{
    return ViroFabricContainerComponentView.class;
}
