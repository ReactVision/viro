type Props = {
    source: unknown;
    rotation?: [number, number, number];
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function Viro360Image(props: Props): null;
export {};
