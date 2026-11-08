//
//  VROVirtualControllerRegistry.h
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

#ifndef VROVirtualControllerRegistry_h
#define VROVirtualControllerRegistry_h

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

class VROInputState;

/*
 Process-wide registry of named virtual controllers, each identified by a
 string id (e.g. "p1", "p2"). Source adapters and consumers find each other
 by referring to the same id.

 Typical use:

     // Bridge / view manager, on JS mounting <ViroVirtualController id="p1">:
     auto state = VROVirtualControllerRegistry::instance().acquire("p1");

     // Touch joystick / gamepad / tilt adapter writes to the same id:
     state->setStickL(x, y);
     state->setButton(VROInputState::Button_A, pressed);

     // Game loop reader (VROFrameListener / VROGameLoopListener):
     auto snap = state->snapshot();
     float forward = -snap.stickLY;

     // On unmount:
     VROVirtualControllerRegistry::instance().release("p1");

 Acquire/release are reference-counted internally so multiple subscribers can
 share the same id and the state survives as long as anyone holds it.

 Thread-safety: all methods are safe to call from any thread. The internal
 map is mutex-guarded; the VROInputState shared_ptr returned to callers is
 itself thread-safe via its own mutex (see VROInputState).
 */

class VROVirtualControllerRegistry {

public:

    static VROVirtualControllerRegistry &instance();

    /*
     Return the VROInputState bound to the given id, creating one if none
     exists. Increments an internal reference count so the state stays alive
     until a matching release() call.
     */
    std::shared_ptr<VROInputState> acquire(const std::string &id);

    /*
     Look up an existing state without creating one. Returns nullptr if no
     adapter or subscriber has acquired this id yet. Does not affect the ref
     count. Use this from frame-loop readers that should fail gracefully
     when the controller hasn't been wired up yet.
     */
    std::shared_ptr<VROInputState> peek(const std::string &id) const;

    /*
     Decrement the reference count for this id. When the count reaches zero
     the state is removed from the registry and destroyed; the next acquire()
     for that id allocates a fresh one.
     */
    void release(const std::string &id);

    /*
     Test helper / diagnostic: number of distinct ids currently bound.
     */
    size_t size() const;

private:

    VROVirtualControllerRegistry() = default;
    VROVirtualControllerRegistry(const VROVirtualControllerRegistry &) = delete;
    VROVirtualControllerRegistry &operator=(const VROVirtualControllerRegistry &) = delete;

    struct Entry {
        std::shared_ptr<VROInputState> state;
        int refCount = 0;
    };

    mutable std::mutex _mtx;
    std::unordered_map<std::string, Entry> _entries;

};

#endif /* VROVirtualControllerRegistry_h */
