"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDIO_TONE_MAPPING_ENABLED = exports.STUDIO_RENDERER_EFFECTS = void 0;
/**
 * The post-processing Studio asks its renderer for, on both hosts.
 *
 * Bloom off: it defaults on natively, the editor previews none, and a bright
 * material glows on the device and nowhere else.
 *
 * HDR on. Hable's curve is a real problem — it renders pure white at about 0.77
 * — but HDR is not the switch for it. virocore's isPBREnabled() is `_hdrEnabled
 * && _pbrEnabled`, so switching HDR off takes the whole PBR branch of
 * VROShaderFactory with it: roughness, metalness and the AO map are read by
 * nothing, and a glTF material drops to Blinn, where its default specular
 * renders the model white. The curve is switched off per scene instead, through
 * ViroScene's `toneMappingEnabled`, which both hosts pass.
 */
exports.STUDIO_RENDERER_EFFECTS = {
    hdrEnabled: true,
    bloomEnabled: false,
};
/** Studio previews no tone curve, so no scene of its renders under one. */
exports.STUDIO_TONE_MAPPING_ENABLED = false;
