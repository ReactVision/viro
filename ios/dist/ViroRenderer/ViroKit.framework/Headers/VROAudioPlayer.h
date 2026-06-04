//
//  VROAudioPlayer.h
//  ViroRenderer
//
//  Created by Raj Advani on 3/22/16.
//  Copyright © 2016 Viro Media. All rights reserved.
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
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#ifndef VROAudioPlayer_h
#define VROAudioPlayer_h

#include <string>
#include <memory>
#include "VROSoundDelegateInternal.h"

class VROData;

class VROAudioPlayer {
    
public:
    
    virtual ~VROAudioPlayer() {}
  
    virtual void setup() = 0;
    virtual void setDelegate(std::shared_ptr<VROSoundDelegateInternal> delegate) {
      _delegate = delegate;
    }
  
    virtual void setLoop(bool loop) = 0;
    virtual void play() = 0;
    virtual void pause() = 0;
    virtual void setVolume(float volume) = 0;
    virtual void setMuted(bool muted) = 0;
    virtual void seekToTime(float seconds) = 0;

    /*
     Streaming PCM API. Subclasses that support runtime PCM feeding override
     these; the default no-ops preserve all existing non-streaming subclasses.

     beginStreaming: configure the player for streaming mode (instead of
       loading a file/blob). Must be called before play(). sampleRate is in
       Hz; channels is 1 (mono) or 2 (stereo).

     pushSamples: feed interleaved float PCM samples in the range [-1, 1].
       Thread-safe — may be called from any thread (sim loop, TTS callback,
       etc.). Returns the number of samples accepted; if the ring buffer is
       full the excess is dropped.

     isStreaming: true once beginStreaming has been called successfully.
    */
    virtual void beginStreaming(int sampleRate, int channels) {}
    virtual size_t pushSamples(const float *data, size_t count) { return 0; }
    virtual bool isStreaming() const { return false; }

protected:
    std::shared_ptr<VROSoundDelegateInternal> _delegate;
};

#endif /* VROAudioPlayer_h */
