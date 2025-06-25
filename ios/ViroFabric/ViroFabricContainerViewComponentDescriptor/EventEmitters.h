//
//  EventEmitters.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#pragma once

#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/core/EventEmitter.h>

namespace facebook {
namespace react {

class ViroFabricContainerViewEventEmitter : public ViewEventEmitter {
 public:
  using ViewEventEmitter::ViewEventEmitter;

  void onInitialized(bool success) const {
    dispatchEvent("onInitialized", [success](jsi::Runtime &runtime) {
      auto payload = jsi::Object(runtime);
      payload.setProperty(runtime, "success", jsi::Value(success));
      return payload;
    });
  }

  void onTrackingUpdated(std::string state) const {
    dispatchEvent("onTrackingUpdated", [state](jsi::Runtime &runtime) {
      auto payload = jsi::Object(runtime);
      payload.setProperty(
          runtime, "state", jsi::String::createFromUtf8(runtime, state));
      return payload;
    });
  }

  void onCameraTransformUpdate(std::map<std::string, float> transform) const {
    dispatchEvent("onCameraTransformUpdate", [transform](jsi::Runtime &runtime) {
      auto payload = jsi::Object(runtime);
      auto transformObj = jsi::Object(runtime);
      
      for (const auto& pair : transform) {
        transformObj.setProperty(
            runtime, 
            pair.first.c_str(), 
            jsi::Value(pair.second));
      }
      
      payload.setProperty(runtime, "transform", std::move(transformObj));
      return payload;
    });
  }
};

// Helper functions for bridging between Objective-C and C++
inline bool RCTBridgingToEventEmitterOnInitialized(NSDictionary *event) {
  return [event[@"success"] boolValue];
}

inline std::string RCTBridgingToEventEmitterOnTrackingUpdated(NSDictionary *event) {
  NSString *state = event[@"state"] ?: @"";
  return std::string([state UTF8String]);
}

inline std::map<std::string, float> RCTBridgingToEventEmitterOnCameraTransformUpdate(NSDictionary *event) {
  std::map<std::string, float> result;
  NSDictionary *transform = event[@"transform"];
  
  if (transform) {
    for (NSString *key in transform) {
      NSNumber *value = transform[key];
      result[[key UTF8String]] = [value floatValue];
    }
  }
  
  return result;
}

} // namespace react
} // namespace facebook
