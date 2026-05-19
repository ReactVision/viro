//
//  VROInputState.h
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

#ifndef VROInputState_h
#define VROInputState_h

#include <stdint.h>
#include <mutex>

/*
 Unified controller state for game-style continuous input. Filled by zero or more
 source adapters (virtual touch joystick, MFi/Bluetooth gamepad, device tilt,
 voice, hand-tracking) and read by consumers (game loop, simulation adapter,
 native modules forwarding to JS).

 Independent of VROInputControllerBase / VROInputPresenter, which are oriented at
 pointer/click events for raycasting in AR/VR scenes. VROInputState models the
 "continuous controller snapshot" use case: per-frame stick deflections, button
 hold states, analog triggers.

 Thread-safety: write methods are safe to call from any thread (touch handler,
 gamepad callback, sensor thread). Readers call snapshot() to get a consistent
 view of the entire state in one shot. Internal mutex contention is negligible
 because each writer touches the state at most a few times per frame.

 Button indices are caller-defined; the table below documents the recommended
 default mapping for game-style apps. Adapters can map their physical inputs
 to any index they like.
 */

class VROInputState {

public:

    static constexpr int kMaxButtons = 32;

    /*
     Recommended button-index mapping for SM64-style inputs and most casual
     games. Adapters that target this layout populate buttons at these indices;
     consumers that read this layout know what each bit means. Mappings are
     not enforced — they are conventions.
     */
    enum DefaultButton : int {
        Button_A   = 0,   // jump / primary action
        Button_B   = 1,   // attack / grab / secondary action
        Button_X   = 2,
        Button_Y   = 3,
        Button_Z   = 4,   // crouch / ground-pound
        Button_L1  = 5,
        Button_R1  = 6,
        Button_L2  = 7,
        Button_R2  = 8,
        Button_Start  = 9,
        Button_Select = 10,
        Button_StickLClick = 11,
        Button_StickRClick = 12,
        Button_DPad_Up    = 13,
        Button_DPad_Down  = 14,
        Button_DPad_Left  = 15,
        Button_DPad_Right = 16,
        // 17..31 free for app-specific buttons
    };

    /*
     Plain-data snapshot returned by snapshot() and consumed by readers. Safe
     to copy and pass across threads.
     */
    struct Snapshot {
        float stickLX = 0.f;
        float stickLY = 0.f;
        float stickRX = 0.f;
        float stickRY = 0.f;
        float triggerL = 0.f;
        float triggerR = 0.f;
        uint32_t buttonBits = 0;   // bit i = button i state (1 = pressed)

        bool getButton(int idx) const {
            if (idx < 0 || idx >= kMaxButtons) return false;
            return (buttonBits & (1u << idx)) != 0;
        }
    };

    VROInputState() = default;

    /*
     Reader API. Returns a consistent snapshot of every field. Cheap; takes the
     mutex once.
     */
    Snapshot snapshot() const;

    /*
     Writer API. Each call takes the mutex briefly. Adapters can call these
     from any thread.

     Stick axis convention: x in [-1, 1] left-to-right, y in [-1, 1]
     down-to-up. Adapters are responsible for sign conventions and clamping;
     values outside [-1, 1] are accepted but consumers may behave oddly.
     */
    void setStickL(float x, float y);
    void setStickR(float x, float y);
    void setTriggerL(float value);
    void setTriggerR(float value);
    void setButton(int idx, bool pressed);

    /*
     Reset all fields to neutral (sticks zeroed, triggers zeroed, no buttons
     pressed). Called when a source adapter unregisters or when a controller
     is intentionally cleared (e.g. on app background).
     */
    void reset();

private:

    mutable std::mutex _mtx;
    Snapshot _state;

};

#endif /* VROInputState_h */
