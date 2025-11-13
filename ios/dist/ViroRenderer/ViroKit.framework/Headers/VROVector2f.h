//
//  VROVector2f.h
//  ViroRenderer
//
//  Copyright © 2025 Viro Media. All rights reserved.
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

#ifndef VROVECTOR2F_H_
#define VROVECTOR2F_H_

#include <stdlib.h>
#include <math.h>
#include <string>

class VROVector2f {
public:
    float x;
    float y;

    VROVector2f() noexcept : x(0), y(0) {}
    VROVector2f(float x, float y) : x(x), y(y) {}

    VROVector2f &operator*=(const float multiplier) {
        x *= multiplier;
        y *= multiplier;
        return *this;
    }

    VROVector2f &operator/=(const float divisor) {
        x /= divisor;
        y /= divisor;
        return *this;
    }

    VROVector2f &operator+=(const VROVector2f &rhs) {
        x += rhs.x;
        y += rhs.y;
        return *this;
    }

    VROVector2f &operator-=(const VROVector2f &rhs) {
        x -= rhs.x;
        y -= rhs.y;
        return *this;
    }

    VROVector2f operator+(const VROVector2f &vec) const {
        VROVector2f result = *this;
        result += vec;
        return result;
    }

    VROVector2f operator-(const VROVector2f &vec) const {
        VROVector2f result = *this;
        result -= vec;
        return result;
    }

    VROVector2f operator*(const float multiplier) const {
        VROVector2f result = *this;
        result *= multiplier;
        return result;
    }

    VROVector2f operator/(const float divisor) const {
        VROVector2f result = *this;
        result /= divisor;
        return result;
    }

    bool operator==(const VROVector2f &rhs) const {
        return x == rhs.x && y == rhs.y;
    }

    bool operator!=(const VROVector2f &rhs) const {
        return !(*this == rhs);
    }

    float magnitude() const {
        return sqrtf(x * x + y * y);
    }

    float distance(const VROVector2f &to) const {
        float dx = to.x - x;
        float dy = to.y - y;
        return sqrtf(dx * dx + dy * dy);
    }

    VROVector2f normalize() const {
        float mag = magnitude();
        if (mag > 0) {
            return VROVector2f(x / mag, y / mag);
        }
        return VROVector2f(0, 0);
    }

    float dot(const VROVector2f &rhs) const {
        return x * rhs.x + y * rhs.y;
    }

    std::string toString() const {
        return "[" + std::to_string(x) + ", " + std::to_string(y) + "]";
    }
};

#endif /* VROVECTOR2F_H_ */
