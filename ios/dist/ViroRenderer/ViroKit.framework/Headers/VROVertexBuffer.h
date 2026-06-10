//
//  VROVertexBuffer.h
//  ViroKit
//
//  Created by Raj Advani on 6/29/19.
//  Copyright © 2019 Viro Media. All rights reserved.
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

#ifndef VROVertexBuffer_h
#define VROVertexBuffer_h

#include <stdio.h>
#include "VROData.h"

/*
 Hint indicating how often the buffer's contents will be updated. Maps to GL_*_DRAW
 hints on OpenGL ES and informs storage mode selection on Metal. Static buffers
 cannot be updated after the initial hydrate(); subclasses that support updates
 should warn when updateData() is called on a Static buffer.

 NOTE: an explicit underlying type (`int`) is fixed so this enum can be
 forward-declared in other headers (e.g. VRODriver.h) without dragging in
 VROVertexBuffer.h's transitive includes.
 */
enum class VROVertexBufferUsage : int {
    Static,    // Set once, drawn many times (default; matches legacy behaviour)
    Dynamic,   // Updated occasionally
    Stream,    // Updated every frame
};

class VROVertexBuffer {
public:

    VROVertexBuffer(std::shared_ptr<VROData> data) :
        _data(data),
        _usage(VROVertexBufferUsage::Static) {}

    VROVertexBuffer(std::shared_ptr<VROData> data, VROVertexBufferUsage usage) :
        _data(data),
        _usage(usage) {}

    virtual ~VROVertexBuffer() {}

    /*
     Upload this buffer to the GPU. No-op if this buffer is already on the GPU.
     */
    virtual void hydrate() = 0;

    /*
     Replace the underlying CPU data and re-upload the new contents to the existing
     GPU buffer object in place. Preserves the GPU handle (no new VBO allocation), so
     any geometry substrate that references this buffer continues to work without
     being rebuilt.

     The default implementation is a silent no-op so that subclasses which don't
     support mutable updates compile without changes. Subclasses that DO support
     updates should override and may warn when called on a Static-usage buffer
     (see VROVertexBufferOpenGL::updateData for the canonical implementation).

     The new data's size must not exceed the size with which the buffer was first
     hydrated. Larger updates require recreating the substrate.
     */
    virtual void updateData(std::shared_ptr<VROData> newData) {
        // Intentional no-op default. See class comment above.
    }

    /*
     Get the data (on the CPU) underlying this vertex buffer.
     */
    std::shared_ptr<VROData> getData() const { return _data; }

    /*
     Get the update-frequency hint declared at construction.
     */
    VROVertexBufferUsage getUsage() const { return _usage; }

protected:

    std::shared_ptr<VROData> _data;
    VROVertexBufferUsage _usage;

};

#endif /* VROVertexBuffer_h */
