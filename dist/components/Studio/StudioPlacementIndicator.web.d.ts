/**
 * Web host for StudioPlacementIndicator. Same component, same hook, same
 * behaviour — DOM instead of react-native primitives.
 *
 * Why not just let react-native-web handle it: `react-native-web` is an
 * *optional* peer dependency of this package, and no other `.web.tsx` in the
 * tree imports from "react-native". A web build without it installed would fail
 * to resolve the import rather than degrade, and a Studio scene previewed on
 * web would take the whole navigator down with it. Plain DOM has no such
 * dependency and the styles here are a direct transcription of the native
 * StyleSheet, so the two look the same.
 *
 * The logic lives in useStudioPlacement(), which is React and a store and is
 * already platform-agnostic — so nothing about *when* this appears is
 * duplicated here.
 */
import * as React from "react";
export declare function StudioPlacementIndicator(): React.JSX.Element | null;
