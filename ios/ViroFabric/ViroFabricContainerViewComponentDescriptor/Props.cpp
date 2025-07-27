//
//  Props.cpp
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#include "Props.h"
#include <react/renderer/core/propsConversions.h>

namespace facebook {
namespace react {

ViroFabricContainerViewProps::ViroFabricContainerViewProps(
    const PropsParserContext &context,
    const ViroFabricContainerViewProps &sourceProps,
    const RawProps &rawProps)
    : ViewProps(context, sourceProps, rawProps),
      apiKey(
          rawProps.getString("apiKey", sourceProps.apiKey)),
      debug(
          rawProps.getBool("debug", sourceProps.debug)),
      arEnabled(
          rawProps.getBool("arEnabled", sourceProps.arEnabled)),
      worldAlignment(
          rawProps.getString("worldAlignment", sourceProps.worldAlignment)) {
}

} // namespace react
} // namespace facebook
