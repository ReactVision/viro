//
//  ViroFabricContainerComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricContainerComponentView.h"
#import "ViroFabricContainer.h"

#import <React/RCTConversions.h>
#import <React/RCTViewComponentView.h>

// Forward declarations for Fabric types
namespace facebook {
namespace react {

// Simplified Props structure
struct ViroFabricContainerViewProps {
    bool debug = false;
    bool arEnabled = false;
    std::string worldAlignment = "Gravity";
};

// Simplified EventEmitter structure
struct ViroFabricContainerViewEventEmitter {
    struct OnInitialized {
        bool success;
    };
    
    struct OnTrackingUpdated {
        int state;
        int reason;
    };
    
    struct OnCameraTransformUpdate {
        // Simplified for now
    };
    
    void onInitialized(OnInitialized event) const {}
    void onTrackingUpdated(OnTrackingUpdated event) const {}
    void onCameraTransformUpdate(OnCameraTransformUpdate event) const {}
};

// Simplified ComponentDescriptor
struct ViroFabricContainerViewComponentDescriptor {};

} // namespace react
} // namespace facebook

using namespace facebook::react;

// Forward declare the protocol
@protocol RCTViroFabricContainerViewViewProtocol;

// Forward declare the command handler
void RCTViroFabricContainerViewHandleCommand(
    id<RCTViroFabricContainerViewViewProtocol> componentView,
    NSString const *commandName,
    NSArray const *args);

// Forward declare event emitter conversion functions
void RCTBridgingToEventEmitterOnInitialized(NSDictionary *event);
void RCTBridgingToEventEmitterOnTrackingUpdated(NSDictionary *event);
void RCTBridgingToEventEmitterOnCameraTransformUpdate(NSDictionary *event);

@interface ViroFabricContainerComponentView () <RCTViroFabricContainerViewViewProtocol>
@end

@implementation ViroFabricContainerComponentView {
    ViroFabricContainer *_viroFabricContainer;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return nullptr;
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroFabricContainerViewProps>();
        _props = defaultProps;
        
        // Create the ViroFabricContainer
        // In Fabric, we'll get the bridge from the surface presenter when available
        _viroFabricContainer = [[ViroFabricContainer alloc] initWithBridge:[self getBridgeFromSurface]];
        _viroFabricContainer.frame = self.bounds;
        _viroFabricContainer.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        
        // Add the ViroFabricContainer as a subview
        [self addSubview:_viroFabricContainer];
        
        // Set up the event handlers
        __weak __typeof(self) weakSelf = self;
        
        _viroFabricContainer.onInitialized = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                // Call the conversion function for logging/debugging
                RCTBridgingToEventEmitterOnInitialized(event);
                
                // Create a simple event struct and emit it
                ViroFabricContainerViewEventEmitter::OnInitialized eventData = {
                    .success = [event[@"success"] boolValue]
                };
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onInitialized(eventData);
            }
        };
        
        _viroFabricContainer.onTrackingUpdated = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                // Call the conversion function for logging/debugging
                RCTBridgingToEventEmitterOnTrackingUpdated(event);
                
                // Create a simple event struct and emit it
                ViroFabricContainerViewEventEmitter::OnTrackingUpdated eventData = {
                    .state = [event[@"state"] intValue],
                    .reason = [event[@"reason"] intValue]
                };
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onTrackingUpdated(eventData);
            }
        };
        
        _viroFabricContainer.onCameraTransformUpdate = ^(NSDictionary *event) {
            __typeof(self) strongSelf = weakSelf;
            if (strongSelf && strongSelf->_eventEmitter) {
                // Call the conversion function for logging/debugging
                RCTBridgingToEventEmitterOnCameraTransformUpdate(event);
                
                // Create a simple event struct and emit it
                ViroFabricContainerViewEventEmitter::OnCameraTransformUpdate eventData = {};
                std::dynamic_pointer_cast<const ViroFabricContainerViewEventEmitter>(strongSelf->_eventEmitter)
                    ->onCameraTransformUpdate(eventData);
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

- (void)initialize:(BOOL)debug arEnabled:(BOOL)arEnabled worldAlignment:(NSString *)worldAlignment
{
    [_viroFabricContainer initialize:debug arEnabled:arEnabled worldAlignment:worldAlignment];
}

- (void)cleanup
{
    [_viroFabricContainer cleanup];
}

#pragma mark - Helper Methods

- (RCTBridge *)getBridgeFromSurface
{
    // In Fabric mode, we don't have direct access to the bridge
    // The ViroFabricContainer is designed to handle nil bridge gracefully
    // This is the expected behavior for New Architecture components
    
    // Try to get bridge from the shared RCTBridge instance as a fallback
    Class bridgeClass = NSClassFromString(@"RCTBridge");
    if (bridgeClass) {
        // Try to get the current bridge instance
        if ([bridgeClass respondsToSelector:@selector(currentBridge)]) {
            RCTBridge *bridge = [bridgeClass performSelector:@selector(currentBridge)];
            if (bridge) {
                return bridge;
            }
        }
    }
    
    // Return nil - ViroFabricContainer handles this gracefully in Fabric mode
    return nil;
}

@end

// Register the component with React Native
Class<RCTComponentViewProtocol> ViroFabricContainerViewCls(void)
{
    return ViroFabricContainerComponentView.class;
}
