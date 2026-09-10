/**
 * The light rig Studio scenes render under, shared by the native and web hosts.
 *
 * The editor's rig is a uniform ambient plus one directional at [10, 10, 10]
 * aimed at the origin, and these are the same two lights. The intensities are
 * not the editor's numbers, though: three.js divides a light's irradiance by PI
 * through BRDF_Lambert, while virocore's ambient term is `ambient * albedo` and
 * its PBR direct term cancels the PI out again, so a Viro intensity of 1000
 * lands where a three.js intensity of PI does. Effective 0.3 + 0.7 puts a lit
 * face at exactly full albedo, which is where an image or a text quad already
 * renders: both surfaces draw those unlit (Constant here, meshBasicMaterial
 * there), so a model beside one has to reach the same level.
 */
/** Intensities in a neutrally lit room. Light estimation scales both together. */
export declare const STUDIO_AMBIENT_INTENSITY = 300;
export declare const STUDIO_DIRECTIONAL_INTENSITY = 700;
/** From the editor's main light at [10, 10, 10] toward the origin; virocore normalises it. */
export declare const STUDIO_DIRECTIONAL_DIRECTION: [number, number, number];
/** Smallest scale change worth a bridge write. The estimate arrives every frame. */
export declare const STUDIO_LIGHT_SCALE_STEP = 0.02;
/**
 * How far to dim the whole rig for the room's measured light. Both lights take
 * the same factor, which is what keeps the shading: raising the ambient alone
 * lifts the floor under a fixed direct term, so a bright room flattens a model
 * back towards the single-ambient look this rig replaced.
 *
 * It never exceeds 1, because there is no headroom above it. The rig is
 * calibrated so a face turned at the light lands on full albedo, and with no
 * tone mapping anything past that clips to white, which costs the same shading
 * a second way. So a neutral or bright room renders the rig as authored, which
 * is also the editor's rig exactly, and only a dim room pulls the two apart.
 */
export declare function studioLightScale(estimate: number): number;
