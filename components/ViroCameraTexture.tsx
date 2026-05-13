/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  requireNativeComponent,
  ViewProps,
} from "react-native";
import { ViroErrorEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";

const { VRTCameraTextureModule } = NativeModules;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViroCameraPosition = "front" | "back";

export type ViroCameraReadyEvent = Record<string, never>;

/**
 * Result returned by capturePhoto / startRecording / stopRecording.
 * Mirrors the response shape from both iOS and Android NativeModules.
 */
export type ViroCaptureResult =
  | { success: true; url: string }
  | { success: false; error: string };

export type ViroCapturePhotoOptions = {
  /** Absolute file path for the JPEG. Defaults to a cache-dir path. */
  outputPath?: string;
};

export type ViroCaptureVideoOptions = {
  /** Absolute file path for the MP4. Defaults to a cache-dir path. */
  outputPath?: string;
};

type Props = ViewProps & {
  /**
   * Name of the material (created via ViroMaterials.createMaterials) to bind
   * the live camera feed to as its diffuse texture. Unlike ViroMaterialVideo,
   * this component creates the camera texture internally and sets it on the
   * named material — the material only needs a lightingModel defined.
   */
  material: string;

  /**
   * Which device camera to use. Front camera feed is automatically mirrored
   * for a natural selfie effect. Defaults to "front".
   */
  cameraPosition?: ViroCameraPosition;

  /**
   * Whether camera capture is paused. When true the last captured frame is
   * held and battery usage drops to near zero. Defaults to false.
   */
  paused?: boolean;

  /**
   * Called once when the first camera frame is available and the texture is
   * ready to be rendered. Fires from the native AVFoundation / Camera2 callback,
   * not immediately on mount.
   */
  onCameraReady?: () => void;

  /**
   * Called when the camera fails to initialise (permission denied, hardware
   * error, invalid material name, etc.).
   */
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ViroCameraTexture binds a live device camera feed to a named material texture.
 *
 * The component creates the camera texture internally and sets it on the material,
 * so the material only needs a lightingModel. The texture is updated every frame.
 *
 * **Usage:**
 * ```tsx
 * import { ViroMaterials, ViroQuad, ViroCameraTexture } from '@reactvision/react-viro';
 *
 * ViroMaterials.createMaterials({
 *   selfieMat: { lightingModel: 'Constant' },
 * });
 *
 * <ViroARScene>
 *   <ViroQuad position={[0, 0, -2]} width={1.6} height={2.4} materials={["selfieMat"]} />
 *   <ViroCameraTexture
 *     material="selfieMat"
 *     cameraPosition="front"
 *     onCameraReady={() => console.log('Camera ready')}
 *     onError={(e) => console.error(e.nativeEvent.error)}
 *   />
 * </ViroARScene>
 * ```
 */
export class ViroCameraTexture extends React.Component<Props> {
  _component: ViroNativeRef = null;

  _onCameraReady = () => {
    this.props.onCameraReady && this.props.onCameraReady();
  };

  _onError = (event: NativeSyntheticEvent<ViroErrorEvent>) => {
    this.props.onError && this.props.onError(event);
  };

  // ---------------------------------------------------------------------------
  // Capture API
  // ---------------------------------------------------------------------------

  /**
   * Capture a single JPEG still from the camera feed.
   *
   * @param options.outputPath  Absolute path for the output JPEG.
   *                            Omit to let the native layer choose a default
   *                            cache-directory path.
   * @returns  Promise resolving to `{ success: true, url }` on success or
   *           `{ success: false, error }` on failure.
   *
   * @example
   * ```ts
   * const result = await cameraRef.current?.capturePhoto();
   * if (result?.success) console.log('Saved to', result.url);
   * ```
   */
  async capturePhoto(
    options: ViroCapturePhotoOptions = {}
  ): Promise<ViroCaptureResult> {
    const tag = findNodeHandle(this._component);
    if (tag == null) {
      return { success: false, error: "ViroCameraTexture is not mounted" };
    }
    return VRTCameraTextureModule.capturePhoto(
      tag,
      options.outputPath ?? null
    ) as Promise<ViroCaptureResult>;
  }

  /**
   * Start recording the camera feed to an MP4 file.
   *
   * The promise resolves once the recording session has successfully started.
   * Call {@link stopRecording} to finalise the file.
   *
   * @param options.outputPath  Absolute path for the output MP4.
   *                            Omit to let the native layer choose a default.
   * @returns  Promise resolving to `{ success: true, url }` (the path that
   *           will be written) or `{ success: false, error }`.
   *
   * @example
   * ```ts
   * await cameraRef.current?.startRecording();
   * // … some time later …
   * const result = await cameraRef.current?.stopRecording();
   * if (result?.success) console.log('Video saved to', result.url);
   * ```
   */
  async startRecording(
    options: ViroCaptureVideoOptions = {}
  ): Promise<ViroCaptureResult> {
    const tag = findNodeHandle(this._component);
    if (tag == null) {
      return { success: false, error: "ViroCameraTexture is not mounted" };
    }
    return VRTCameraTextureModule.startRecording(
      tag,
      options.outputPath ?? null
    ) as Promise<ViroCaptureResult>;
  }

  /**
   * Stop an in-progress recording and finalise the MP4 file.
   *
   * @returns  Promise resolving to `{ success: true, url }` with the path of
   *           the written file, or `{ success: false, error }`.
   */
  async stopRecording(): Promise<ViroCaptureResult> {
    const tag = findNodeHandle(this._component);
    if (tag == null) {
      return { success: false, error: "ViroCameraTexture is not mounted" };
    }
    return VRTCameraTextureModule.stopRecording(
      tag
    ) as Promise<ViroCaptureResult>;
  }

  render() {
    const nativeProps = Object.assign({} as any, this.props);
    nativeProps.cameraPosition = this.props.cameraPosition ?? "front";
    nativeProps.paused = this.props.paused ?? false;
    nativeProps.onCameraReadyViro = this._onCameraReady;
    nativeProps.onErrorViro = this._onError;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRTCameraTexture {...nativeProps} />;
  }
}

// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------

const VRTCameraTexture = requireNativeComponent<any>(
  "VRTCameraTexture",
  // @ts-ignore
  ViroCameraTexture,
  {
    nativeOnly: {
      onCameraReadyViro: true,
      onErrorViro: true,
    },
  }
);
