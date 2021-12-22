import { ViroAnimation, ViroAnimationChainDict, ViroAnimationDict } from "./ViroAnimations";
export declare class ViroAnimationValidation {
    static validateAnimationProp(prop: string, animationName: string, animation: ViroAnimation, caller: any): void;
    /**
     * Iterate through array to determine if there are empty chains (invalid)
     * or if there are any empty elements within a given chain (invalid)
     */
    static validateAnimationChain(name: string, animations: ViroAnimationChainDict): void;
    static validateAnimation(name: string, animations: ViroAnimationDict): void;
    static addValidAnimationPropTypes(animationPropTypes: any): void;
}
