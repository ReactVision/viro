//
//  VROGameLoopListener.h
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

#ifndef VROGameLoopListener_h
#define VROGameLoopListener_h

#include <functional>
#include "VROFrameListener.h"
#include "VROTime.h"

/*
 VROGameLoopListener — thin VROFrameListener wrapper that tracks delta time and
 elapsed time, then fires typed callbacks from the render thread.

 Typical use (C++, from native bridge code):

     auto loop = std::make_shared<VROGameLoopListener>();
     loop->setOnFrameWillRender([](float dt, float elapsed) {
         // game logic here — runs before physics and rendering
     });
     frameSynchronizer->addFrameListener(loop);

 For fixed-step simulation (F5 addendum):

     loop->setFixedHz(30);
     loop->setOnFixedStep([](float dt) {
         // guaranteed 1/30 s ticks
     });

 Thread safety: callbacks are invoked on the render thread. Callers are
 responsible for marshalling to another thread if needed.
 */
class VROGameLoopListener : public VROFrameListener {
public:
    using UpdateCallback    = std::function<void(float dtSec, float elapsedSec)>;
    using FixedStepCallback = std::function<void(float dtSec)>;

    VROGameLoopListener() = default;
    ~VROGameLoopListener() override = default;

    // ── Variable-step callbacks ────────────────────────────────────────────────

    void setOnFrameWillRender(UpdateCallback cb) { _onWillRender = std::move(cb); }
    void setOnFrameDidRender(UpdateCallback cb)  { _onDidRender  = std::move(cb); }

    // ── Fixed-step (F5 addendum) ───────────────────────────────────────────────

    /*
     Set the fixed simulation frequency in Hz (e.g. 30 for libsm64, 60 for typical
     physics). Each onFrameWillRender call drains the accumulator, firing the fixed-
     step callback as many times as needed to stay in sync with wall time.
     A clamped dt prevents a "spiral of death" when frames are very slow.
     */
    void setFixedHz(float hz) {
        _fixedHz      = hz;
        _fixedDt      = (hz > 0.f) ? 1.f / hz : 0.f;
        _accumulator  = 0.f;
        _fixedEnabled = (hz > 0.f);
    }
    void setOnFixedStep(FixedStepCallback cb) { _onFixedStep = std::move(cb); }

    // ── VROFrameListener ──────────────────────────────────────────────────────

    void onFrameWillRender(const VRORenderContext &context) override {
        double now = VROTimeCurrentMillis();
        if (_startTime < 0.0) _startTime = _lastTime = now;

        float dt      = (float)((now - _lastTime)  / 1000.0);
        float elapsed = (float)((now - _startTime) / 1000.0);
        _lastTime = now;

        // Fixed-step drain — clamp frame dt to avoid spiral of death
        if (_fixedEnabled && _onFixedStep && _fixedDt > 0.f) {
            float safeDt = (dt < kMaxFrameDt) ? dt : kMaxFrameDt;
            _accumulator += safeDt;
            while (_accumulator >= _fixedDt) {
                _onFixedStep(_fixedDt);
                _accumulator -= _fixedDt;
            }
        }

        if (_onWillRender) _onWillRender(dt, elapsed);
    }

    void onFrameDidRender(const VRORenderContext &context) override {
        if (!_onDidRender) return;
        double now    = VROTimeCurrentMillis();
        float dt      = (float)((now - _lastTime)  / 1000.0);
        float elapsed = (float)((now - _startTime) / 1000.0);
        _onDidRender(dt, elapsed);
    }

private:
    // Maximum frame delta clamped in fixed-step mode (prevents spiral of death
    // if the app is paused or debugging halts the render loop).
    static constexpr float kMaxFrameDt = 0.25f;  // 4 fps floor

    UpdateCallback    _onWillRender;
    UpdateCallback    _onDidRender;
    FixedStepCallback _onFixedStep;

    double _startTime   = -1.0;
    double _lastTime    = -1.0;

    bool  _fixedEnabled = false;
    float _fixedHz      = 0.f;
    float _fixedDt      = 0.f;
    float _accumulator  = 0.f;
};

#endif /* VROGameLoopListener_h */
