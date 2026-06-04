//
//  VROAudioPlayerStreamiOS.h
//  ViroKit
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

#ifndef VROAudioPlayerStreamiOS_h
#define VROAudioPlayerStreamiOS_h

#include "VROAudioPlayer.h"
#include "VROPCMRingBuffer.h"
#include <memory>
#include <atomic>

#ifdef __OBJC__
@class AVAudioEngine;
@class AVAudioSourceNode;
@class AVAudioFormat;
#else
// Forward declarations for non-ObjC translation units (Android, WASM).
typedef void AVAudioEngine;
typedef void AVAudioSourceNode;
typedef void AVAudioFormat;
#endif

/*
 Streaming PCM audio player for iOS using AVAudioEngine + AVAudioSourceNode.

 Usage:
   auto player = std::make_shared<VROAudioPlayerStreamiOS>();
   player->beginStreaming(32000, 2);   // stereo @ 32 kHz
   player->setVolume(1.0f);
   player->play();
   // from any thread:
   player->pushSamples(floatBuffer, frameCount * channels);

 The AVAudioSourceNode render block drains the VROPCMRingBuffer on the
 real-time audio thread (no locks). If the ring is empty, silence is output.
 Spatialisation (position / attenuation) is NOT applied here — this player
 is for non-spatial streaming audio. Spatial streaming is tracked separately.
*/
class VROAudioPlayerStreamiOS : public VROAudioPlayer {

public:

    VROAudioPlayerStreamiOS();
    virtual ~VROAudioPlayerStreamiOS();

    // VROAudioPlayer overrides
    void setup() override;
    void setLoop(bool loop) override   {}  // streaming is continuous; loop is a no-op
    void play() override;
    void pause() override;
    void setVolume(float volume) override;
    void setMuted(bool muted) override;
    void seekToTime(float seconds) override {}  // not meaningful for live PCM

    // Streaming API
    void beginStreaming(int sampleRate, int channels) override;
    size_t pushSamples(const float *data, size_t count) override;
    bool isStreaming() const override { return _streaming; }

private:

    void teardown();

#ifdef __OBJC__
    AVAudioEngine      *_engine     = nil;
    AVAudioSourceNode  *_sourceNode = nil;
    AVAudioFormat      *_format     = nil;
#else
    void *_engine     = nullptr;
    void *_sourceNode = nullptr;
    void *_format     = nullptr;
#endif

    std::shared_ptr<VROPCMRingBuffer> _ring;
    std::atomic<bool> _playing  { false };
    std::atomic<bool> _muted    { false };
    std::atomic<float> _volume  { 1.0f  };
    bool _streaming = false;
};

#endif /* VROAudioPlayerStreamiOS_h */
