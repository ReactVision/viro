/**
 * Web host for StudioColocationIndicator: DOM instead of react-native, for the
 * reason in StudioPlacementIndicator.web.tsx. On web a `colocation` prop only
 * ever reports that the frame kind is unsupported, which this shows.
 */
import * as React from "react";
export declare function StudioColocationIndicator(): React.JSX.Element | null;
