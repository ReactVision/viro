//
//  Props.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#pragma once

#include <react/renderer/components/view/ViewProps.h>
#include <react/renderer/core/PropsParserContext.h>
#include <react/renderer/core/propsConversions.h>

namespace facebook {
namespace react {

// Define the props for the ViroFabricContainerView component
class ViroFabricContainerViewProps : public ViewProps {
 public:
  ViroFabricContainerViewProps() = default;
  ViroFabricContainerViewProps(
      const PropsParserContext &context,
      const ViroFabricContainerViewProps &sourceProps,
      const RawProps &rawProps);

  // Define the props specific to ViroFabricContainerView
  std::string apiKey{};
  bool debug{false};
  bool arEnabled{false};
  std::string worldAlignment{"Gravity"};
};

// Define the shadow node for the ViroFabricContainerView component
class ViroFabricContainerViewShadowNode : public ConcreteViewShadowNode<
                                          ViroFabricContainerViewProps> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;

  static ShadowNodeTraits BaseTraits() {
    auto traits = ConcreteViewShadowNode::BaseTraits();
    traits.set(ShadowNodeTraits::Trait::ViewKind);
    return traits;
  }
};

} // namespace react
} // namespace facebook
