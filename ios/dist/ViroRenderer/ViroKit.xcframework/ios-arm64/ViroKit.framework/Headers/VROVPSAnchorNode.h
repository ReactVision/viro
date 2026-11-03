//
//  VROVPSAnchorNode.h
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
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#ifndef VROVPSAnchorNode_h
#define VROVPSAnchorNode_h

#include <functional>
#include "VRONode.h"

/*
 A node whose children live in the VPS map's frame. Registered with a
 VROARScene (addVPSAnchorNode()), it takes the session's map-to-world
 transform every frame, the same one the VPS map mesh follows, so content
 and mesh move together with each fuser correction.

 Like VROARDeclarativeNode it stays hidden until placed: the app's own
 setHidden() is kept and combined with the placement.
 */
class VROVPSAnchorNode : public VRONode {
public:

    VROVPSAnchorNode() {}
    virtual ~VROVPSAnchorNode() {}

    virtual void setHidden(bool hidden) {
        _userHidden = hidden;
        VRONode::setHidden(!_placed || _userHidden);
    }

    bool isPlaced() const {
        return _placed;
    }

    /*
     Called by VROARScene on the render thread. The listener hears only
     changes; `force` re-applies the visibility (on registration).
     */
    void setPlaced(bool placed, bool force = false) {
        if (placed == _placed && !force) {
            return;
        }
        bool changed = placed != _placed;
        _placed = placed;
        VRONode::setHidden(!_placed || _userHidden);
        if (changed && _placedListener) {
            _placedListener(placed);
        }
    }

    /*
     Invoked on the render thread when the node is placed or loses its
     placement (tracking stopped, map unloaded).
     */
    void setPlacedListener(std::function<void(bool)> listener) {
        _placedListener = listener;
    }

private:

    bool _placed = false;
    bool _userHidden = false;
    std::function<void(bool)> _placedListener;
};

#endif /* VROVPSAnchorNode_h */
