/**
 * Copyright © 2026 ReactVision
 *
 * React Native's asset registry, on 0.88 and on the 0.86 visionOS fork.
 */

import { AssetRegistry } from "react-native";

type GetAssetByID = (assetId: number) => any;

// `null` once we know neither source has it, so the lookup is not retried on every call.
let cached: GetAssetByID | null | undefined;

/**
 * The registry's `getAssetByID`, or `null` when this React Native has none.
 *
 * React Native 0.88 exports `AssetRegistry` from `react-native` and removed
 * `Libraries/Image/AssetRegistry.js`. The 0.86 visionOS fork is the other way round: the file is
 * there and the export is not. So: the export first, then the file.
 *
 * The fallback `require` is a plain static one, directly inside the `try` block. Metro marks a
 * `require` there as an optional dependency (`allowOptionalDependencies`, on by default in Metro,
 * `@react-native/metro-config` and `@expo/metro-config`): it bundles the file when it resolves and,
 * on 0.88 where it does not, leaves a `require` that throws at runtime instead of failing the
 * build. Keep it directly in the `try` block — Metro only looks a few statements up for it.
 */
export function getAssetByIDFunction(): GetAssetByID | null {
  if (cached !== undefined) {
    return cached;
  }

  // Undefined on the 0.86 fork, whatever the 0.88 types say.
  const registry = AssetRegistry as typeof AssetRegistry | undefined;
  if (typeof registry?.getAssetByID === "function") {
    cached = (assetId) => registry.getAssetByID(assetId);
    return cached;
  }

  try {
    const legacy = require("react-native/Libraries/Image/AssetRegistry");
    if (legacy && typeof legacy.getAssetByID === "function") {
      cached = (assetId) => legacy.getAssetByID(assetId);
      return cached;
    }
  } catch {
    // Not there on 0.88; handled below.
  }

  cached = null;
  return cached;
}
