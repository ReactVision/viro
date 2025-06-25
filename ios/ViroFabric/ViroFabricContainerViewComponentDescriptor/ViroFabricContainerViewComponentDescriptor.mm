//
//  ViroFabricContainerViewComponentDescriptor.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTMacros.h>

// Import the component view
#import "ViroFabricContainerComponentView.h"

// Register the component with React Native
RCT_EXPORT_COMPONENT_VIEW_PROPERTY(apiKey, NSString)
RCT_EXPORT_COMPONENT_VIEW_PROPERTY(debug, BOOL)
RCT_EXPORT_COMPONENT_VIEW_PROPERTY(arEnabled, BOOL)
RCT_EXPORT_COMPONENT_VIEW_PROPERTY(worldAlignment, NSString)

// Register the event handlers
RCT_EXPORT_COMPONENT_VIEW_EVENT(onInitialized)
RCT_EXPORT_COMPONENT_VIEW_EVENT(onTrackingUpdated)
RCT_EXPORT_COMPONENT_VIEW_EVENT(onCameraTransformUpdate)

// Register the commands
RCT_EXPORT_COMPONENT_VIEW_COMMANDS(initialize, cleanup)

// Register the component with React Native's Fabric system
Class<RCTComponentViewProtocol> ViroFabricContainerViewCls(void);
RCT_REGISTER_COMPONENT_VIEW_CLASS(ViroFabricContainerView, ViroFabricContainerViewCls)
