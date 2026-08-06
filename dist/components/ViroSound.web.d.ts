export type ViroSoundProps = {
    source: unknown;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroSound(props: ViroSoundProps): null;
