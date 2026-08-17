import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    source: unknown;
    width?: number;
    height?: number;
    style?: {
        width?: number;
        height?: number;
    } & Record<string, unknown>;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroImage(props: Props): null;
export {};
