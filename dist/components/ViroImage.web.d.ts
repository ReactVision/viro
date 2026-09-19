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
/** A quad and the slice of the picture stretched over it. */
export interface ImageSurface {
    width: number;
    height: number;
    /** [u0, v0, u1, v1]; the whole picture is [0, 0, 1, 1]. */
    uv: [number, number, number, number];
}
/**
 * The quad's dimensions and UVs, following VRTImage's rules.
 *
 * `aspect` is null until the picture has been decoded, because every branch but
 * the first needs to know its shape.
 */
export declare function resolveSurface(width: number, height: number, sizeAuthored: boolean, resizeMode: ResizeMode, resizeModeAuthored: boolean, aspect: number | null, clipMode?: ClipMode): ImageSurface;
export declare function ViroImage(props: Props): null;
export {};
