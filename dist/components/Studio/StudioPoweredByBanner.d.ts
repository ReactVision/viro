import * as React from "react";
import { StyleProp, ViewStyle } from "react-native";
export declare const STUDIO_POWERED_BY_URL = "https://studio.reactvision.xyz/?utm_source=scenenavigator-banner";
interface StudioPoweredByBannerProps {
    /**
     * Override the tap handler — e.g. to add analytics or open an in-app
     * browser. Defaults to opening the Studio site with the device browser.
     */
    onPress?: () => void;
    /** Override the displayed text, e.g. with a localised string. */
    label?: string;
    /**
     * Override/extend the container positioning, e.g. to seat the pill above a
     * host's own controls or honour safe-area insets.
     */
    style?: StyleProp<ViewStyle>;
}
/**
 * Persistent "Powered by ReactVision Studio" watermark shown over the scene
 * for Free-tier scenes. Kept dependency-free (plain react-native) so it ships
 * with the library; the host can pass `onPress`/`label`/`style` for richer
 * behaviour.
 */
export declare function StudioPoweredByBanner({ onPress, label, style, }: StudioPoweredByBannerProps): React.JSX.Element;
export {};
