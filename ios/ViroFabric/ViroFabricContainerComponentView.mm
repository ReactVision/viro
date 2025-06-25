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

template<typename T>
ComponentDescriptorProvider concreteComponentDescriptorProvider() {
    return nullptr;
}

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
    return concreteComponentDescriptorProvider<ViroFabricContainerViewComponentDescriptor>();
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
    // Try to get the bridge from the surface presenter
    // This is a fallback approach for Fabric components
    if (self.surfacePresenter) {
        // In newer versions of React Native, we can get the bridge from the surface presenter
        if ([self.surfacePresenter respondsToSelector:@selector(bridge)]) {
            return [self.surfacePresenter performSelector:@selector(bridge)];
        }
    }
    
    // Fallback: try to get bridge from the shared RCTBridge instance
    // This is not ideal but may work in some cases
    Class bridgeClass = NSClassFromString(@"RCTBridge");
    if (bridgeClass) {
        // Try to get the current bridge instance
        if ([bridgeClass respondsToSelector:@selector(currentBridge)]) {
            return [bridgeClass performSelector:@selector(currentBridge)];
        }
    }
    
    // Last resort: return nil and handle gracefully
    return nil;
}

@end

// Register the component with React Native
Class<RCTComponentViewProtocol> ViroFabricContainerViewCls(void)
{
    return ViroFabricContainerComponentView.class;
}
