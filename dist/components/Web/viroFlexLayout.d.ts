/**
 * Flexbox layout for ViroFlexView on web.
 *
 * Native does not lay this out itself: React Native's shadow tree runs Yoga over
 * the view hierarchy at 1000 points per metre and hands each view a frame, which
 * VRTNode then turns into a 3D position and a size for the child (see
 * VRTNode.mm's recalcLayout). There is no shadow tree on web, so the measuring
 * happens here — in a detached DOM subtree laid out by the browser's own
 * flexbox, at the same 1000 points per metre.
 *
 * Using the browser rather than a hand-written flexbox is the point: Yoga is a
 * reimplementation of CSS flexbox, so the browser agrees with it wherever the
 * defaults agree, and those defaults are the part worth stating explicitly —
 * React Native lays out in a column, stretches on the cross axis, and never
 * shrinks, none of which is what CSS does on its own.
 */
/** What virocore's world unit is worth in layout points. Native's k2DPointsPerSpatialUnit. */
export declare const FLEX_POINTS_PER_METER = 1000;
/**
 * How far in front of the container a child sits. Native's own nudge: coplanar
 * quads z-fight, and the child has to win the hit test against its background.
 */
export declare const FLEX_CHILD_Z = 0.01;
export type FlexRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type FlexSlot = {
    /** Metres, relative to the container's centre, ready for setNodePosition. */
    position: [number, number, number];
    /** Metres. */
    width: number;
    height: number;
};
/** The subset of a React Native style that changes where a child lands. */
export type FlexStyle = Record<string, unknown> | undefined;
/**
 * A measured child frame, in points with the origin at the container's top-left
 * and y going down, as a position and size in metres about the container's
 * centre with y going up.
 */
export declare function rectToSlot(rect: FlexRect, containerWidthPoints: number, containerHeightPoints: number): FlexSlot;
/**
 * A React Native style as the CSS declarations that lay it out the same way.
 *
 * The three defaults at the end are React Native's, not the browser's, and the
 * difference is not cosmetic: CSS lays out in a row and shrinks items to fit, so
 * a column of fixed-height children would come out as a squashed row.
 */
export declare function styleToCss(style: FlexStyle, isContainer: boolean): Record<string, string>;
/**
 * Lay the children out inside a container of this size and return each one's
 * frame in points. An empty array back means the browser could not measure —
 * no document, or a zero-sized container — and the caller should leave the
 * children as they authored themselves rather than stack them all at the origin.
 */
export declare function measureFlexChildren(containerStyle: FlexStyle, childStyles: FlexStyle[], widthMeters: number, heightMeters: number): FlexRect[];
