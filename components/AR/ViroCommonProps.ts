import { ViroAnimation } from "../Animation/ViroAnimations";
import {
  ViroAnchor,
  ViroAnchorFoundMap,
  ViroAnchorUpdatedMap,
  ViroClickState,
  ViroErrorEvent,
  ViroPinchState,
  ViroRotateState,
} from "../Types/ViroEvents";
import {
  ViroPhysicsBody,
  Viro3DPoint,
  ViroRotation,
  ViroScale,
  ViroSource,
} from "../Types/ViroUtils";
import {
  ViroShaderModifiers,
  ViroShaderUniform,
} from "../Material/ViroMaterials";
import { NativeSyntheticEvent, ViewProps } from "react-native";

export type ViroCommonProps = ViewProps & {
  target?: string;

  pauseUpdates?: boolean;
  renderingOrder?: number;
  visible?: boolean;
  opacity?: number;
  ignoreEventHandling?: boolean;
  dragType?:
    | "FixedDistance"
    | "FixedDistanceOrigin"
    | "FixedToWorld"
    | "FixedToPlane";
  dragPlane?: {
    planePoint: Viro3DPoint;
    planeNormal: Viro3DPoint;
    maxDistance: number;
  };

  onHover?: (
    isHovering: boolean,
    position: Viro3DPoint,
    source: ViroSource
  ) => void;
  /**
   * Fires when the node is hovered by the eye-gaze ray specifically (Meta Quest
   * Pro, via XR_EXT_eye_gaze_interaction). Same payload as onHover but limited to
   * the eye-gaze input source; onHover still fires for every source (controllers,
   * hands, eye gaze). Setting onGaze alone is enough to enable hover events on the
   * node. No-op on devices without eye tracking.
   */
  onGaze?: (
    isHovering: boolean,
    position: Viro3DPoint,
    source: ViroSource
  ) => void;
  onClick?: (position: Viro3DPoint, source: ViroSource) => void;
  onClickState?: (
    clickState: ViroClickState,
    position: Viro3DPoint,
    source: ViroSource
  ) => void;
  onTouch?: (
    touchState: any,
    touchPos: Viro3DPoint,
    source: ViroSource
  ) => void;
  onScroll?: (scrollPos: Viro3DPoint, source: ViroSource) => void;
  onSwipe?: (swipeState: any, source: ViroSource) => void;
  onDrag?: (dragToPos: Viro3DPoint, source: ViroSource) => void;
  onPinch?: (
    pinchState: ViroPinchState,
    scaleFactor: number,
    source: ViroSource
  ) => void;
  onRotate?: (
    rotateState: ViroRotateState,
    rotationFactor: number,
    source: ViroSource
  ) => void;
  onFuse?:
    | { callback: (source: any) => void; timeToFuse?: number }
    | ((source: any) => void);
  onCollision?: (
    viroTag: string,
    collidedPoint: Viro3DPoint,
    collidedNormal: Viro3DPoint
  ) => void;
  viroTag?: string;
  onAnchorFound?: (anchorFoundMap: ViroAnchorFoundMap) => void;
  onAnchorUpdated?: (anchorUpdatedMap: ViroAnchorUpdatedMap) => void;
  onAnchorRemoved?: ((event?: ViroAnchor) => void) | (() => void);
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

export type ViroObjectProps = {
  position?: Viro3DPoint;
  scale?: ViroScale;
  rotation?: ViroRotation;
  scalePivot?: Viro3DPoint;
  rotationPivot?: Viro3DPoint;
  renderingOrder?: number;
  visible?: boolean;
  opacity?: number;
  width?: number;
  height?: number;
  length?: number;
  materials?: ViroSource[] | string | string[];
  animation?: ViroAnimation;
  transformBehaviors?: string | string[];
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  shaderModifiers?: ViroShaderModifiers;
  /**
   * Apply named materials to this node and all its children as a merge rather than a
   * replacement. Unlike `materials`, which swaps the root geometry's material out and
   * with it a GLB or VRX model's embedded textures and skinning, `shaderOverrides`
   * copies the named material's shader modifiers and rendering properties onto every
   * mesh in the hierarchy, along with the colours, textures and PBR values the material
   * was registered with. A property the material definition does not name is left as
   * the model authored it, so a definition carrying only `diffuseColor` recolours a
   * textured model without discarding its texture.
   *
   * Accepts an array of material names previously registered via `ViroMaterials.createMaterials`.
   */
  shaderOverrides?: string[];
  materialUniforms?: { [key: string]: any } | ViroShaderUniform[];

  onTransformUpdate?: (position: Viro3DPoint) => void;

  /**
   * Enables high accuracy event collision checks for this object.
   * This can be useful for complex 3D objects where the default
   * checking method of bounding boxes do not provide adequate
   * collision detection coverage.
   *
   * NOTE: Enabling high accuracy event collision checks has a high
   * performance cost and should be used sparingly / only when
   * necessary.
   *
   * Flag is set to false by default.
   */
  highAccuracyEvents?: boolean;
  /**
   * DEPRECATION WARNING - highAccuracyGaze has been deprecated, please use highAccuracyEvents instead
   * @deprecated
   */
  highAccuracyGaze?: boolean;
  physicsBody?: ViroPhysicsBody;

  onCollision?: () => void;
  onAnimationStartViro?: () => void;
  onAnimationFinishViro?: () => void;
};
