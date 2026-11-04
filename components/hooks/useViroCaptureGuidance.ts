/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroCaptureGuidance
 */

"use strict";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, PixelRatio } from "react-native";
import {
  createViroCaptureGuidance,
  createViroCaptureHitSampler,
  ViroCaptureGuidance,
  ViroCaptureGuidanceState,
  ViroCaptureHint,
  ViroCaptureHitResult,
  ViroCaptureRules,
} from "../AR/ViroCaptureGuidance";
import type { ViroCameraTransform } from "../Types/ViroEvents";
import type { Viro3DPoint } from "../Types/ViroUtils";

export type ViroCaptureGuidanceOptions = {
  /**
   * Guidance runs while this is true. Each time it turns true the totals start
   * again from zero, so turn it on for each recording.
   */
  enabled: boolean;
  /**
   * The `ViroARScene` to hit test. It is hit tested at the centre of the
   * window, so pass `hitTest` instead when the AR view does not fill it.
   */
  sceneRef?: React.RefObject<{
    performARHitTestWithPoint: (x: number, y: number) => Promise<any>;
  } | null>;
  /** Your own centre hit test, used instead of `sceneRef`. */
  hitTest?: () => Promise<readonly ViroCaptureHitResult[] | null | undefined>;
  /**
   * How often to hit test and update the hint, in milliseconds. Defaults to 250.
   * Changing it, or `hitTestTimeoutMs`, while enabled starts the totals again.
   */
  intervalMs?: number;
  /** A hit test pending longer than this many milliseconds is given up on. Defaults to 1000. */
  hitTestTimeoutMs?: number;
  /** Overrides for `VIRO_CAPTURE_RULES`, read when guidance is enabled. */
  rules?: Partial<ViroCaptureRules>;
};

export type ViroCaptureGuidanceResult = {
  /** The hint to show now, or null. The component re-renders only when this changes. */
  hint: ViroCaptureHint | null;
  /**
   * The latest hint, per-hint seconds and jump count. After guidance is
   * turned off it still returns the last recording's totals, until the next
   * time it is turned on.
   */
  getState: () => ViroCaptureGuidanceState | null;
  /** Pass to `ViroARScene`'s `onCameraTransformUpdate`. Undefined while guidance is off. */
  onCameraTransformUpdate: ((transform: ViroCameraTransform) => void) | undefined;
};

/**
 * Capture guidance for recording a space: samples the camera pose and a hit
 * test at the centre of the view, and reports which hint to show.
 *
 * @example
 * ```tsx
 * const sceneRef = useRef<ViroARScene>(null);
 * const guidance = useViroCaptureGuidance({ sceneRef, enabled: recording });
 * <ViroARScene ref={sceneRef} onCameraTransformUpdate={guidance.onCameraTransformUpdate} />
 * ```
 */
export function useViroCaptureGuidance(
  options: ViroCaptureGuidanceOptions
): ViroCaptureGuidanceResult {
  const { enabled, intervalMs = 250, hitTestTimeoutMs = 1000 } = options;
  const [hint, setHint] = useState<ViroCaptureHint | null>(null);
  // Read through refs so an inline options object does not restart a recording's guidance.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const guideRef = useRef<ViroCaptureGuidance | null>(null);
  const stateRef = useRef<ViroCaptureGuidanceState | null>(null);
  const cameraRef = useRef<Viro3DPoint | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const guide = createViroCaptureGuidance(optionsRef.current.rules);
    guideRef.current = guide;
    stateRef.current = null;
    cameraRef.current = null;
    const sampler = createViroCaptureHitSampler({
      hitTest: () => {
        const { hitTest, sceneRef } = optionsRef.current;
        if (hitTest) return hitTest();
        const scene = sceneRef?.current;
        if (!scene) return Promise.reject(new Error("No scene to hit test"));
        const { width, height } = Dimensions.get("window");
        return scene.performARHitTestWithPoint(
          PixelRatio.getPixelSizeForLayoutSize(width / 2),
          PixelRatio.getPixelSizeForLayoutSize(height / 2)
        );
      },
      getCameraPosition: () => cameraRef.current,
      reportHit: (distance) => {
        if (guideRef.current === guide) guide.hit(Date.now() / 1000, distance);
      },
      timeoutMs: hitTestTimeoutMs,
    });
    let last = Date.now();
    let lastHint: ViroCaptureHint | null = null;
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      sampler.sample();
      const state = guide.tick(now / 1000, dt);
      stateRef.current = state;
      if (state.hint !== lastHint) {
        lastHint = state.hint;
        setHint(state.hint);
      }
    }, intervalMs);
    return () => {
      clearInterval(timer);
      sampler.cancel();
      if (guideRef.current === guide) guideRef.current = null;
      cameraRef.current = null;
      setHint(null);
    };
  }, [enabled, intervalMs, hitTestTimeoutMs]);

  const onCameraTransformUpdate = useCallback(
    (transform: ViroCameraTransform) => {
      cameraRef.current = transform.position;
      guideRef.current?.pose(
        Date.now() / 1000,
        transform.position,
        transform.forward,
        transform.up
      );
    },
    []
  );

  const getState = useCallback(() => stateRef.current, []);

  return {
    hint,
    getState,
    onCameraTransformUpdate: enabled ? onCameraTransformUpdate : undefined,
  };
}
