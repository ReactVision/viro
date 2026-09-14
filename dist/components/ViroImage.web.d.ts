import { type ViroWebNodeProps } from "./Web/useViroNode";
type ResizeMode = "ScaleToFill" | "ScaleToFit" | "StretchToFill";
type ClipMode = "None" | "ClipToBounds";
type Props = ViroWebNodeProps & {
    source: unknown;
    width?: number;
    height?: number;
    resizeMode?: ResizeMode;
    imageClipMode?: ClipMode;
    style?: {
        width?: number;
        height?: number;
    } & Record<string, unknown>;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
/**
 * The quad's dimensions, following VRTImage's rules.
 *
 * `aspect` is null until the picture has been decoded, because every branch but
 * the first needs to know its shape.
 */
export declare function resolveSurface(width: number, height: number, sizeAuthored: boolean, resizeMode: ResizeMode, resizeModeAuthored: boolean, aspect: number | null): [number, number];
export declare function ViroImage(props: Props): null;
export {};
