import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    source: unknown;
    width?: number;
    height?: number;
    paused?: boolean;
    loop?: boolean;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroAnimatedImage(props: Props): null;
export {};
