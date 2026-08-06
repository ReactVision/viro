/**
 * Web implementation of ViroSpinner — two layered spinner images rotating in
 * opposite directions (matches native's look). `type` ("Dark"/"Light") picks the
 * bundled asset variant; a custom `source`/`sourceReverse` overrides it.
 *
 * Asset note: the built-in spinner PNGs are `require()`d (native parity); this
 * resolves under Metro/webpack (react-native-web). A custom `source` avoids any
 * bundler-specific asset handling.
 */
import * as React from "react";
import type { ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    type?: "Dark" | "Light" | "dark" | "light";
    source?: unknown;
    sourceReverse?: unknown;
    width?: number;
    height?: number;
    [key: string]: any;
};
export declare function ViroSpinner(props: Props): React.JSX.Element;
export {};
