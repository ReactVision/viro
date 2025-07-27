/**
 * ViroUtils
 *
 * Common utility functions and hooks for Viro components.
 */
import React from "react";
import { ViroNodeProps, ViroNodeType } from "../NativeViro";
export declare const ViroContext: React.Context<string>;
export declare const useViroParent: () => string;
export declare function useViroNode(nodeType: ViroNodeType, props: ViroNodeProps, explicitParentId?: string): string;
export declare function useViroChildren(nodeId: string, children: React.ReactNode): React.ReactNode;
export type ViroEventHandler = (event: any, ...args: any[]) => void;
export type ViroPosition = [number, number, number];
export type ViroRotation = [number, number, number];
export type ViroScale = [number, number, number] | number;
export interface ViroCommonProps {
    position?: ViroPosition;
    rotation?: ViroRotation;
    scale?: ViroScale;
    transformBehaviors?: string[];
    opacity?: number;
    visible?: boolean;
    animation?: {
        name?: string;
        delay?: number;
        loop?: boolean;
        onStart?: () => void;
        onFinish?: () => void;
        run?: boolean;
        interruptible?: boolean;
    };
    canClick?: boolean;
    canHover?: boolean;
    canTouch?: boolean;
    canScroll?: boolean;
    canSwipe?: boolean;
    canDrag?: boolean;
    canFuse?: boolean;
    canPinch?: boolean;
    canRotate?: boolean;
    timeToFuse?: number;
    onHover?: ViroEventHandler;
    onClick?: ViroEventHandler;
    onClickState?: ViroEventHandler;
    onTouch?: ViroEventHandler;
    onScroll?: ViroEventHandler;
    onSwipe?: ViroEventHandler;
    onDrag?: ViroEventHandler;
    onPinch?: ViroEventHandler;
    onRotate?: ViroEventHandler;
    onFuse?: ViroEventHandler | {
        callback: ViroEventHandler;
        timeToFuse?: number;
    };
    onCollision?: ViroEventHandler;
    onTransformUpdate?: ViroEventHandler;
}
export declare function convertCommonProps(props: ViroCommonProps): ViroNodeProps;
export declare function useViroEventListeners(nodeId: string, eventHandlers: Record<string, ViroEventHandler | undefined>): void;
export declare const ViroContextProvider: ({ value, children, }: {
    value: string;
    children: React.ReactNode;
}) => React.FunctionComponentElement<React.ProviderProps<string>>;
