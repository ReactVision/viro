type Props = {
    material?: string;
    source: unknown;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroMaterialVideo(props: Props): null;
export {};
