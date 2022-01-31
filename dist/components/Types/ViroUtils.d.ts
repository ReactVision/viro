/// <reference types="react" />
import { ImageSourcePropType, NativeMethods } from "react-native";
export declare type ViroSceneDictionary = {
    [val: string]: ViroScene;
};
export declare type ViroScene = {
    tag: string;
    referenceCount: number;
    sceneClass: any;
};
/**
 * Cartesian position in 3D space, stored as [x, y, z].
 */
export declare type Viro3DPoint = [
    number,
    number,
    number
];
/**
 * The rotation of the container around it's local axis specified as Euler angles [x, y, z].
 * Units for each angle are specified in degrees.
 */
export declare type ViroRotation = [
    number,
    number,
    number
];
/**
 * The scale of the container in 3D space, specified as [x,y,z]. A scale of
 * 1 represents the current size of the container. A scale value of < 1
 * will make the container proportionally smaller while a value >1 will make
 * the container proportionally bigger along the specified axis.
 */
export declare type ViroScale = [
    number,
    number,
    number
];
export declare type ViroNativeRef = (React.Component<unknown, {}, any> & Readonly<NativeMethods>) | null;
export declare type ViroPhysicsBody = {
    /**
     * The type of this rigid body.
     */
    type: ViroPhysicsBodyType;
    /**
     * The mass of this physics body in kg.
     */
    mass?: number;
    /**
     * Describes the shape that represents this physics body.
     * If not specified, this is inferred from the geometry of the parent control.
     * Users can specify the shape in the form below:
     *
     * |Physics Shapes |Description|
     * |------|----------|
     * |Box| Accepts [width, height, length] parameters used for creating the box.
     * |Sphere| Accepts radius parameter.
     * |Compound| Usually is set on VRONodes to encapsulate multiple objects in a compound shape. This is achieved by recursing down the scene graph and combining the geometries into a single compound physics shape.
     *
     * Example code:
     *
     * ```typescript
     * shape:{type:'Box', params:[0.4,0.4,0.2]} shape:{type:'Sphere', params:[0.5]}
     * ```
     */
    shape?: ViroPhysicsBodyShape;
    /**
     * The bounciness of an object. Value of 0.0 will not bounce.
     * Value of 1.0 will bounce without any loss of energy.
     */
    restitution?: number;
    /**
     * Determines the force of resistance an object or surface encounters when moving
     * across another. Value of 0.0 implies no friction. Value of 1.0 implies high friction.
     */
    friction?: number;
    /**
     * If false, this physics object will ignore all gravitational forces that are
     * applied on this object.
     */
    useGravity?: boolean;
    /**
     * If false, disables all physics properties on the Viro control (as if there
     * were no physics bodies applied).
     */
    enabled?: boolean;
    /**
     * A single force vector or an array of force vectors applied to the physics body.
     * If an array of forces is provided, the corresponding net force will be applied.
     * Force units are in newtons.
     */
    force?: number[];
    /**
     * A single torque vector or an array of torque vectors applied to the physics body.
     * If an array of torque is provided, the corresponding net torque will be applied.
     * Torque units are in newton meters.
     */
    torque?: number[];
    /**
     * Used to directly move an object without applying a force.
     * Units are m/s. Doing so will override any forces that are already
     * applied on this physics body.
     */
    velocity?: number[];
};
export declare type ViroPhysicsBodyType = "Dynamic" | "Kinematic" | "Static";
export declare type ViroPhysicsBodyShape = {
    type: ViroPhysicsBodyShapeType;
    params: number[];
};
export declare type ViroPhysicsBodyShapeType = "Box" | "Sphere" | "Compound";
/**
 * A single force vector or an array of force vectors applied to the physics body.
 * If an array of forces is provided, the corresponding net force will be applied.
 * Force units are in newtons.
 */
export declare type ViroForce = {
    value: Array<number>;
    position: Array<number>;
};
export declare type ViroSource = ImageSourcePropType;
export declare type ViroARPlaneType = any;
export declare type ViroSoundRoom = {
    size: ViroScale;
    wallMaterial: string;
    ceilingMaterial: string;
    floorMaterial: string;
};
export declare type ViroPhysicsWorld = {
    gravity: number;
    drawBounds?: boolean;
};
export declare type ViroRay = any;
export declare type ViroTorque = any;
export declare type ViroVelocity = any;
export declare type Viro2DPoint = [number, number];
export declare type ViroUVCoordinate = [number, number, number, number];
export declare type ViroSoundMap = {
    [key: string]: ViroSound;
};
export declare type ViroSound = string;
export declare type ViroSoundPreloadResult = {
    [key: string]: {
        result: any;
        msg: any;
    };
};
