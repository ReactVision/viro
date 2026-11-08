//
//  VROPCMRingBuffer.h
//  ViroRenderer
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

#ifndef VROPCMRingBuffer_h
#define VROPCMRingBuffer_h

#include <vector>
#include <atomic>
#include <algorithm>
#include <cstring>

/*
 Lock-free single-producer / single-consumer ring buffer for interleaved float PCM
 samples. Designed for the streaming audio path:

   Producer (any thread): calls write() with chunks of samples from the
     simulation / TTS / synthesiser.

   Consumer (audio callback, real-time thread): calls read() to fill the OS
     audio buffer. Must never block — silence (zeros) is returned when the
     ring is empty.

 Capacity is set at construction and is a power of two so that the index wrap
 is a bitwise AND rather than a modulo. A capacity of 8192 samples at 32 kHz
 stereo gives ~128 ms of headroom, sufficient to absorb a typical JS bridge
 round-trip.

 NOT safe for multiple producers or multiple consumers.
*/
class VROPCMRingBuffer {

public:

    explicit VROPCMRingBuffer(size_t capacitySamples = 8192)
        : _capacity(nextPow2(capacitySamples)),
          _mask(_capacity - 1),
          _buffer(_capacity, 0.0f),
          _writePos(0),
          _readPos(0) {}

    /*
     Write interleaved PCM samples. Called from the producer thread.
     Returns the number of samples actually written (may be less than count
     if the ring is nearly full — caller should retry or drop).
    */
    size_t write(const float *data, size_t count) {
        size_t w = _writePos.load(std::memory_order_relaxed);
        size_t r = _readPos.load(std::memory_order_acquire);
        size_t available = _capacity - (w - r);   // free slots
        size_t toWrite   = std::min(count, available);
        if (toWrite == 0) return 0;

        size_t idx = w & _mask;
        size_t firstPart = std::min(toWrite, _capacity - idx);
        memcpy(_buffer.data() + idx, data, firstPart * sizeof(float));
        if (toWrite > firstPart) {
            memcpy(_buffer.data(), data + firstPart,
                   (toWrite - firstPart) * sizeof(float));
        }
        _writePos.store(w + toWrite, std::memory_order_release);
        return toWrite;
    }

    /*
     Read interleaved PCM samples into out. Called from the audio callback
     (consumer thread). Fills with silence if fewer samples are available
     than requested. Returns number of valid samples read.
    */
    size_t read(float *out, size_t count) {
        size_t r = _readPos.load(std::memory_order_relaxed);
        size_t w = _writePos.load(std::memory_order_acquire);
        size_t available = w - r;
        size_t toRead    = std::min(count, available);

        if (toRead > 0) {
            size_t idx = r & _mask;
            size_t firstPart = std::min(toRead, _capacity - idx);
            memcpy(out, _buffer.data() + idx, firstPart * sizeof(float));
            if (toRead > firstPart) {
                memcpy(out + firstPart, _buffer.data(),
                       (toRead - firstPart) * sizeof(float));
            }
            _readPos.store(r + toRead, std::memory_order_release);
        }

        // Zero-fill any unfulfilled frames (silence on underrun).
        if (toRead < count) {
            memset(out + toRead, 0, (count - toRead) * sizeof(float));
        }
        return toRead;
    }

    int sampleRate() const { return _sampleRate; }
    int channels()   const { return _channels;   }

    void setSampleRate(int sr) { _sampleRate = sr; }
    void setChannels(int ch)   { _channels   = ch; }

    size_t capacity() const { return _capacity; }

    /*
     Approximate number of samples currently buffered. Informational only —
     may be slightly stale by the time the caller acts on it.
    */
    size_t available() const {
        return _writePos.load(std::memory_order_relaxed) -
               _readPos.load(std::memory_order_relaxed);
    }

private:

    static size_t nextPow2(size_t n) {
        size_t p = 1;
        while (p < n) p <<= 1;
        return p;
    }

    const size_t _capacity;
    const size_t _mask;
    std::vector<float> _buffer;

    std::atomic<size_t> _writePos;
    std::atomic<size_t> _readPos;

    int _sampleRate = 44100;
    int _channels   = 1;
};

#endif /* VROPCMRingBuffer_h */
