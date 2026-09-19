/**
 * Web implementation of ViroScene. The scene root node is provided by the
 * navigator (Viro3DSceneNavigator.web), so ViroScene simply renders its children
 * under that root. Scene-level props (background, camera) are follow-ups.
 */
import * as React from "react";
export declare function ViroScene(props: {
    children?: React.ReactNode;
    /** Off drops Hable's curve without dropping PBR — see useViroToneMapping. */
    toneMappingEnabled?: boolean;
    [key: string]: any;
}): React.JSX.Element;
