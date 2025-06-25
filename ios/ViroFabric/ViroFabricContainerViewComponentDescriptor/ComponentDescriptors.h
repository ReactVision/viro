//
//  ComponentDescriptors.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#pragma once

#include <react/renderer/components/ViroFabricContainerViewComponentDescriptor/Props.h>
#include <react/renderer/components/ViroFabricContainerViewComponentDescriptor/EventEmitters.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook {
namespace react {

using ViroFabricContainerViewComponentDescriptor = ConcreteComponentDescriptor<
    ViroFabricContainerViewShadowNode>;

} // namespace react
} // namespace facebook
