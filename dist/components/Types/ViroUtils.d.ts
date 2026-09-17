import { ImageSourcePropType, NativeMethods } from "react-native";
export type ViroSceneDictionary = {
    [val: string]: ViroScene;
};
export type ViroScene = {
    tag: string;
    referenceCount: number;
    sceneClass: any;
};
/**
 * Cartesian position in 3D space, stored as [x, y, z].
 */
export type Viro3DPoint = [
    number,
    number,
    number
];
/**
 * The rotation of the container around it's local axis specified as Euler angles [x, y, z].
 * Units for each angle are specified in degrees.
 */
export type ViroRotation = [
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
export type ViroScale = [
    number,
    number,
    number
];
export type ViroNativeRef = (React.Component<unknown, {}, any> & Readonly<NativeMethods>) | null;
export type ViroPhysicsBody = {
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
     * |Compound| Accepts a list of child boxes and spheres, each with its own position relative to this control. Given none, the compound is inferred instead by recursing down the scene graph and combining the geometries of this control's children.
     *
     * Example code:
     *
     * ```typescript
     * shape:{type:'Box', params:[0.4,0.4,0.2]} shape:{type:'Sphere', params:[0.5]}
     * shape:{type:'Compound', children:[{type:'Box', params:[0.4,0.4,0.2], position:[0,0.2,0]}]}
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
export type ViroPhysicsBodyType = "Dynamic" | "Kinematic" | "Static";
export type ViroPhysicsBodyShape = {
    type: ViroPhysicsBodyShapeType;
    params: number[];
    /**
     * The parts of a Compound shape. Ignored by every other shape type. A part's
     * `params` follow its own type, `position` is relative to this control, and
     * the body's mass is split across the parts by volume.
     */
    children?: ViroPhysicsBodyShapeChild[];
};
export type ViroPhysicsBodyShapeChild = {
    type: "Box" | "Sphere";
    params: number[];
    position: number[];
};
export type ViroPhysicsBodyShapeType = "Box" | "Sphere" | "Compound";
/**
 * A single force vector or an array of force vectors applied to the physics body.
 * If an array of forces is provided, the corresponding net force will be applied.
 * Force units are in newtons.
 */
export type ViroForce = {
    value: Array<number>;
    position: Array<number>;
};
export type ViroSource = ImageSourcePropType;
/**
 * Numeric input-source ids reported in event payloads (event.nativeEvent.source),
 * mirroring the native ViroOculus::InputSource enum. Currently only the eye-gaze
 * source is needed on the JS side (to route onHover -> onGaze).
 */
export declare const ViroEventSource: {
    readonly EYE_GAZE: 12;
};
export type ViroARPlaneType = any;
export type ViroSoundRoom = {
    size: ViroScale;
    wallMaterial: string;
    ceilingMaterial: string;
    floorMaterial: string;
};
export type ViroPhysicsWorld = {
    /**
     * The gravity vector applied to the physics world, specified as [x, y, z].
     * For example, Earth's gravity would be [0, -9.81, 0].
     */
    gravity: Viro3DPoint;
    drawBounds?: boolean;
};
export type ViroRay = any;
export type ViroTorque = any;
export type ViroVelocity = any;
export type Viro2DPoint = [number, number];
export type ViroUVCoordinate = [number, number, number, number];
export type ViroSoundMap = {
    [key: string]: ViroSound;
};
export type ViroSound = string;
export type ViroSoundPreloadResult = {
    [key: string]: {
        result: any;
        msg: any;
    };
};
