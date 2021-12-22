export declare type ViroAnimationDict = {
    [key: string]: ViroAnimation;
};
export declare type ViroAnimation = {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
    properties?: any;
    duration?: number;
    easing?: "Bounce" | "Linear" | "EaseIn" | "EaseOut" | "EaseInEaseOut";
};
export declare class ViroAnimations {
    static registerAnimations(animations: ViroAnimationDict): void;
}
