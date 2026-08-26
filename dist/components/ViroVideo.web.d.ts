import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    source: unknown;
    width?: number;
    height?: number;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroVideo(props: Props): null;
export {};
