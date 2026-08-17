type Props = {
    source: unknown;
    position: [number, number, number];
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    rolloffModel?: "None" | "Linear" | "Logarithmic" | string;
    minDistance?: number;
    maxDistance?: number;
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroSpatialSound(props: Props): null;
export {};
