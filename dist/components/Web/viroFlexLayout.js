"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLEX_CHILD_Z = exports.FLEX_POINTS_PER_METER = void 0;
exports.rectToSlot = rectToSlot;
exports.styleToCss = styleToCss;
exports.measureFlexChildren = measureFlexChildren;
/** What virocore's world unit is worth in layout points. Native's k2DPointsPerSpatialUnit. */
exports.FLEX_POINTS_PER_METER = 1000;
/**
 * How far in front of the container a child sits. Native's own nudge: coplanar
 * quads z-fight, and the child has to win the hit test against its background.
 */
exports.FLEX_CHILD_Z = 0.01;
/**
 * A measured child frame, in points with the origin at the container's top-left
 * and y going down, as a position and size in metres about the container's
 * centre with y going up.
 */
function rectToSlot(rect, containerWidthPoints, containerHeightPoints) {
    // A Viro node's geometry is centred on the node, and a layout frame is a
    // top-left box, so the centre is what crosses over.
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    return {
        position: [
            (centerX - containerWidthPoints / 2) / exports.FLEX_POINTS_PER_METER,
            (containerHeightPoints / 2 - centerY) / exports.FLEX_POINTS_PER_METER,
            exports.FLEX_CHILD_Z,
        ],
        width: rect.width / exports.FLEX_POINTS_PER_METER,
        height: rect.height / exports.FLEX_POINTS_PER_METER,
    };
}
/** Style keys whose numbers are lengths, and so are points here rather than CSS pixels. */
const LENGTHS = new Set([
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "marginHorizontal",
    "marginVertical",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "paddingHorizontal",
    "paddingVertical",
    "top",
    "right",
    "bottom",
    "left",
    "flexBasis",
    "rowGap",
    "columnGap",
    "gap",
]);
/** React Native shorthands CSS has no single property for. */
const AXIS_SHORTHANDS = {
    marginHorizontal: ["marginLeft", "marginRight"],
    marginVertical: ["marginTop", "marginBottom"],
    paddingHorizontal: ["paddingLeft", "paddingRight"],
    paddingVertical: ["paddingTop", "paddingBottom"],
};
/** Everything in a Viro style that is not layout — colours, fonts, borders. */
const IGNORED = new Set([
    "backgroundColor",
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "textAlign",
    "textAlignVertical",
    "textLineBreakMode",
    "textClipMode",
    "borderColor",
    "borderRadius",
    "opacity",
]);
function cssValue(key, value) {
    if (value === undefined || value === null)
        return null;
    if (typeof value === "number") {
        return LENGTHS.has(key) ? `${value}px` : String(value);
    }
    if (typeof value === "string")
        return value;
    return null;
}
/**
 * A React Native style as the CSS declarations that lay it out the same way.
 *
 * The three defaults at the end are React Native's, not the browser's, and the
 * difference is not cosmetic: CSS lays out in a row and shrinks items to fit, so
 * a column of fixed-height children would come out as a squashed row.
 */
function styleToCss(style, isContainer) {
    const out = {};
    if (isContainer) {
        out.display = "flex";
    }
    out.flexDirection = "column";
    out.alignItems = "stretch";
    out.flexShrink = "0";
    out.boxSizing = "border-box";
    out.position = "relative";
    out.margin = "0";
    out.padding = "0";
    for (const [key, raw] of Object.entries(style ?? {})) {
        if (IGNORED.has(key))
            continue;
        const axis = AXIS_SHORTHANDS[key];
        const value = cssValue(key, raw);
        if (value === null)
            continue;
        if (axis) {
            out[axis[0]] = value;
            out[axis[1]] = value;
        }
        else if (key === "flex" && typeof raw === "number") {
            // React Native's `flex: n` is `n 1 0%` in CSS terms, not CSS's `n 1 auto`.
            out.flex = `${raw} 1 0%`;
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
function applyStyle(el, style) {
    for (const [key, value] of Object.entries(style)) {
        el.style[key] = value;
    }
}
/**
 * Lay the children out inside a container of this size and return each one's
 * frame in points. An empty array back means the browser could not measure —
 * no document, or a zero-sized container — and the caller should leave the
 * children as they authored themselves rather than stack them all at the origin.
 */
function measureFlexChildren(containerStyle, childStyles, widthMeters, heightMeters) {
    if (typeof document === "undefined" || childStyles.length === 0)
        return [];
    const widthPoints = widthMeters * exports.FLEX_POINTS_PER_METER;
    const heightPoints = heightMeters * exports.FLEX_POINTS_PER_METER;
    if (!(widthPoints > 0) || !(heightPoints > 0))
        return [];
    const host = document.createElement("div");
    // Off-screen rather than display:none: a hidden subtree is not laid out at all
    // and every rect would come back zero.
    host.style.cssText =
        "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;";
    const container = document.createElement("div");
    applyStyle(container, styleToCss(containerStyle, true));
    container.style.width = `${widthPoints}px`;
    container.style.height = `${heightPoints}px`;
    host.appendChild(container);
    const elements = childStyles.map((childStyle) => {
        const el = document.createElement("div");
        applyStyle(el, styleToCss(childStyle, true));
        container.appendChild(el);
        return el;
    });
    document.body.appendChild(host);
    const containerRect = container.getBoundingClientRect();
    const rects = elements.map((el) => {
        const r = el.getBoundingClientRect();
        return {
            x: r.left - containerRect.left,
            y: r.top - containerRect.top,
            width: r.width,
            height: r.height,
        };
    });
    document.body.removeChild(host);
    return rects;
}
