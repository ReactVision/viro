/// <reference types="react" />
import { ViroStyle } from "./Styles/ViroStyle";
import { Viro2DPoint, ViroUVCoordinate } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
declare type Props = {
    /**
     * An array of boundary vertex positions in local model space.
     * Each point is a 2D array consisting of an X and a Y coordinate.
     * For example:
     * ```typescript
     * vertices={[[-1,0], [0,1], [1,0]]}
     * ```
     */
    vertices: Viro2DPoint[];
    /**
     * An array of arrays. Each inner array contains the boundary
     * vertex positions that define a hole in the polygon.
     * Each vertex position is a 2D array consisting of an X and a
     * Y coordinate in local model space. For example:
     * ```typescript
     * holes={[
     *   [[-0.75, -0.75], [-0.75, -0.50], [-0.50, -0.50], [-0.50, -0.75]],
     *   [[ 0.75, -0.75], [0.75, -0.50], [0.50, -0.50], [0.50, -0.75]]
     * ]}.
     * ```
     */
    holes: Viro2DPoint[][];
    /**
     * An array of 4 values [u0, v0, u1, v1] representing the UV-coordinates which
     * determines how a texture should be tiled across the surface.
     *
     * Texture coordinates are represented on 2D U and V axes (essentially
     * the X and Y axes of the image). The left edge of a texture is U = 0.0
     * and the right edge of the texture is U = 1.0. Similarly, the top edge o
     * f a texture is V=0.0 and the bottom edge of the texture is V=1.0.
     *
     * Specifying greater than 1.0 on either the U or V axis will cause the
     * tile to repeat itself or clamp, depending on the Material's wrapS and
     * wrapT properties. Specifying less than 1.0 on the U or V axis will render
     * that texture partially over the entire surface.
     */
    uvCoordinates?: ViroUVCoordinate;
    style?: ViroStyle;
};
/**
 * Used to render a ViroPolygon
 */
export declare class ViroPolygon extends ViroBase<Props> {
    render(): JSX.Element;
}
export {};
