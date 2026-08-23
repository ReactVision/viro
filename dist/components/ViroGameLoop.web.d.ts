type UpdateEvent = {
    dt: number;
    elapsed: number;
};
type Props = {
    fixedHz?: number;
    paused?: boolean;
    onUpdate?: (event: UpdateEvent) => void;
    onLateUpdate?: (event: UpdateEvent) => void;
    onFixedUpdate?: (event: {
        dt: number;
    }) => void;
    [key: string]: any;
};
export declare function ViroGameLoop(props: Props): null;
export {};
