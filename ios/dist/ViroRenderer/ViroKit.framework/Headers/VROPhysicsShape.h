//
//  VROPhysicsShape.h
//  ViroRenderer
//
//  Copyright © 2017 Viro Media. All rights reserved.
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

#ifndef VROPhysicsShape_h
#define VROPhysicsShape_h

#include "VROLog.h"
#include <memory>
#include <stack>
#include <vector>
#include <string>
#include <algorithm>
#include "VROStringUtil.h"
#include "VROVector3f.h"

class VRONode;
class btCollisionShape;
class btCompoundShape;
class btTransform;
class btTriangleMesh;

/*
 VROPhysicsShape describes the type and dimensions of a physics shape that represents a VROPhysicsBody.
 */
class VROPhysicsShape {

public:
    /*
     VROShapeType describes the type of shape representing this object.
     Required parameters for each shape type are as shown below:
     */
    enum VROShapeType {
        Auto = 0,           // Automatically infer a shape from attached geometry.
        AutoCompound = 1,   // Automatically infer a compound shape from attached geometry.
        Sphere = 2,         // _params[0] represents the radius of the sphere
        Box = 3,            // _params[0],[1],[2] represents the X,Y,Z half span of the Box
        TriangleMesh = 4,   // Triangle mesh for static collision (e.g., depth mesh)
        Compound = 5        // Compound of the boxes and spheres given in _params.
    };
    static const std::string kSphereTag;
    static const std::string kBoxTag;
    static const std::string kAutoCompoundTag;
    static const std::string kTriangleMeshTag;

    /*
     A Compound carries its parts in its params, this many floats each: the part
     type (0 box, 1 sphere), then the box's three spans or the sphere's radius in
     the first of those three slots, then the part's position relative to the
     node. A part's rotation is not carried. Both tags reach this class as
     kAutoCompoundTag: with no params it is the AutoCompound inferred from the
     node's own children, which is what it has always meant, and a trailing
     partial part is dropped rather than rejected, since isValidShape guards a
     caller's params and the bridges build this list themselves.
     */
    static const int kCompoundChildStride = 7;

    /*
     Returns true of the given string and mass represents a valid representation of
     VROPhysicsBodyType. Else, false is returned and the errorMsg is populated
     with the reason for failure.
     */
    static bool isValidShape(std::string strType, std::vector<float> params, std::string &errorMsg) {
        if (!VROStringUtil::strcmpinsensitive(strType, kSphereTag)
            && !VROStringUtil::strcmpinsensitive(strType, kBoxTag)
            && !VROStringUtil::strcmpinsensitive(strType,kAutoCompoundTag)) {
            errorMsg = "Provided invalid shape of type: " + strType;
            return false;
        } else if (VROStringUtil::strcmpinsensitive(strType, kSphereTag) && params.size() != 1) {
            errorMsg = "Invalid params provided for type sphere! Expected 1 parameter for radius.";
            return false;
        } else if (VROStringUtil::strcmpinsensitive(strType, kBoxTag) && params.size() != 3) {
            errorMsg = "Invalid params provided for type box! Expected 3 parameter defining [x,y,z].";
            return false;
        }
        return true;
    }

    static VROPhysicsShape::VROShapeType getTypeForString(std::string strType) {
        if (VROStringUtil::strcmpinsensitive(strType, kSphereTag)) {
            return VROPhysicsShape::VROShapeType::Sphere;
        } else if (VROStringUtil::strcmpinsensitive(strType, kAutoCompoundTag)) {
            return VROPhysicsShape::VROShapeType::AutoCompound;
        }
        return VROPhysicsShape::VROShapeType::Box;
    }

    VROPhysicsShape(VROShapeType type, std::vector<float> params = std::vector<float>());
    VROPhysicsShape(std::shared_ptr<VRONode> node, bool hasCompoundShapes = false);

    /**
     * Construct a triangle mesh collision shape from vertices and indices.
     * Used for depth mesh collision against real-world surfaces.
     * Note: Triangle mesh shapes can only be used with Static physics bodies.
     *
     * @param vertices Array of 3D vertex positions
     * @param indices Triangle indices (every 3 values form a triangle)
     */
    VROPhysicsShape(const std::vector<VROVector3f>& vertices,
                    const std::vector<int>& indices);

    virtual ~VROPhysicsShape();

    /*
     Returns the Bullet representation of a VROPhysicsShape.
     */
    btCollisionShape* getBulletShape();

    /*
     Returns true if this VROShape was generated from the geometry of the
     node it is attached to.
     */
    bool getIsGeneratedFromGeometry();

    /*
     Returns true if this VROShape was generated from a combination of several
     geometric shapes (compound shape).
     */
    bool getIsCompoundShape();

    /*
     Returns the transform between the node's origin and the center of mass that
     this shape's parts were moved onto when it was built. Null for every shape
     but a compound built from given parts.
     */
    const btTransform *getCompoundCenterOfMassOffset();

    /*
     Returns the mass of each part of a compound shape. A compound built from
     given parts splits the body's mass by each part's volume, which is what the
     editors hand their own engines; one inferred from geometry splits it evenly,
     as it always has. Empty for a non-compound shape.
     */
    std::vector<float> getCompoundChildMasses(float totalMass);

private:
    /*
     Parameters that describe the dimensions of a shape.
     See VROShapeType for what parameters should be defined for which shape type.
     */
    VROShapeType _type;
    btCollisionShape* _bulletShape;

    /*
     Stores triangle mesh data for TriangleMesh shapes.
     Bullet requires this to persist for the lifetime of the shape.
     */
    btTriangleMesh* _triangleMesh = nullptr;

    /*
     Where the center of mass of a compound built from given parts sits relative
     to the node, saved when the parts were moved onto it.
     */
    btTransform* _compoundCenterOfMassOffset = nullptr;

    /*
     Creates an underlying bullet collision shape representing this VROPhysicsShape,
     given the target shape type and associated params.
     */
    btCollisionShape *generateBasicBulletShape(VROShapeType type, std::vector<float> params);

    /*
     Infers from the geometry associated with the given node to create an underlying
     bullet collision shape representing this VROPhysicsShape.
     */
    btCollisionShape *generateBasicBulletShape(std::shared_ptr<VRONode> node);

    /*
     Creates a compound bullet shape out of the parts given in params, and moves
     those parts onto the center of mass Bullet will simulate the body about.
     */
    btCollisionShape *generateAuthoredCompoundShape(const std::vector<float> &params);

    /*
     Recursively examines each node within the given root node's subtree and automatically infer
     the corresponding bullet collision shape of each node. These shapes are then combined and
     returned as a compound bullet shape.
     */
    void generateCompoundBulletShape(btCompoundShape &compoundShape,
                                     const std::shared_ptr<VRONode> &rootNode,
                                     const std::shared_ptr<VRONode> &childNode);

    /*
     Creates a BVH triangle mesh collision shape from vertices and indices.
     Used for static collision geometry like depth meshes.
     */
    btCollisionShape *generateTriangleMeshShape(const std::vector<VROVector3f>& vertices,
                                                const std::vector<int>& indices);

};
#endif
