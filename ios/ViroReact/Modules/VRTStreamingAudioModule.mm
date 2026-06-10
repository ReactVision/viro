//
//  VRTStreamingAudioModule.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.

#import "VRTStreamingAudioModule.h"
#import <React/RCTLog.h>
#import <ViroKit/VROAudioPlayerStreamiOS.h>
#include <map>
#include <string>
#include <memory>

@implementation VRTStreamingAudioModule {
    std::map<std::string, std::shared_ptr<VROAudioPlayerStreamiOS>> _players;
}

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(create:(NSString *)playerId) {
    std::string key = playerId.UTF8String;
    auto player = std::make_shared<VROAudioPlayerStreamiOS>();
    player->setup();
    _players[key] = player;
}

RCT_EXPORT_METHOD(beginStreaming:(NSString *)playerId
                  sampleRate:(nonnull NSNumber *)sampleRate
                  channels:(nonnull NSNumber *)channels) {
    std::string key = playerId.UTF8String;
    auto it = _players.find(key);
    if (it != _players.end()) {
        it->second->beginStreaming([sampleRate intValue], [channels intValue]);
    }
}

RCT_EXPORT_METHOD(play:(NSString *)playerId) {
    auto it = _players.find(std::string(playerId.UTF8String));
    if (it != _players.end()) it->second->play();
}

RCT_EXPORT_METHOD(pause:(NSString *)playerId) {
    auto it = _players.find(std::string(playerId.UTF8String));
    if (it != _players.end()) it->second->pause();
}

RCT_EXPORT_METHOD(setVolume:(NSString *)playerId volume:(nonnull NSNumber *)volume) {
    auto it = _players.find(std::string(playerId.UTF8String));
    if (it != _players.end()) it->second->setVolume([volume floatValue]);
}

RCT_EXPORT_METHOD(setMuted:(NSString *)playerId muted:(BOOL)muted) {
    auto it = _players.find(std::string(playerId.UTF8String));
    if (it != _players.end()) it->second->setMuted((bool)muted);
}

/*
 Accepts base64-encoded little-endian IEEE 754 float32 PCM samples.
 Callers on JS side: btoa(String.fromCharCode(...new Uint8Array(float32Array.buffer)))
*/
RCT_EXPORT_METHOD(pushSamples:(NSString *)playerId samples:(NSString *)base64Samples) {
    auto it = _players.find(std::string(playerId.UTF8String));
    if (it == _players.end()) return;

    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Samples options:0];
    if (!data || data.length == 0) return;

    const float *floats = static_cast<const float *>(data.bytes);
    size_t count = data.length / sizeof(float);
    it->second->pushSamples(floats, count);
}

RCT_EXPORT_METHOD(destroy:(NSString *)playerId) {
    _players.erase(std::string(playerId.UTF8String));
}

@end
