type Props = {
    source: unknown;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    rotation?: [number, number, number];
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function Viro360Video(props: Props): null;
export {};
