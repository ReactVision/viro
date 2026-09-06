/**
 * ViroVisionOSSweep — M6 component sweep scene for Apple Vision Pro
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * One page per verdict tier from plans/visionos-component-sweep.md, so that a failure is
 * attributable on sight instead of needing a bisect. Only components whose backend is present
 * in the visionOS target appear here — putting an unsupported component on screen would produce
 * a link error, not a red box, and would take the whole sweep down with it.
 *
 * ── Corrected 2026-08-25 (Session 26). Three assumptions in the original header were wrong: ──
 *
 *   ViroSkyBox now WORKS. The portal background family was implemented, and a stub constructor
 *   that never set VRONodeType::Portal — which made VRONode::getParentPortal() return nullptr and
 *   crashed VRTSkybox on a null dereference — was fixed. A solid-colour skybox needs no cube map.
 *
 *   Input is NOT inert. Two-handed tracking, ray, pinch, hover and click are implemented and were
 *   validated on device. What is still unproven is the last hop into JavaScript — see
 *   InputTestScene in the testbed, and note the Simulator has no hand tracking at all.
 *
 *   The scene host is NOT Viro3DSceneNavigator. That component is the OpenGL presentation path
 *   (it builds an EAGLContext and hosts a VROViewScene) and is excluded from the visionOS build
 *   outright. Use ViroXRSceneNavigator, which routes to ViroSceneNavigator and hands the scene to
 *   the ImmersiveSpace renderer. Its scene must be rooted in ViroScene, never ViroARScene.
 *
 * Deliberately NOT in this scene, and why:
 *   Viro360Image / Viro360Video               no video texture backend on xros
 *   ViroVideo / ViroMaterialVideo              VROVideoTextureiOS is not in the target
 *   ViroSound / ViroSoundField / SpatialSound  no audio backend
 *   ViroPortal / ViroPortalScene               traversePortals has no recursion
 *   ViroCameraTexture / ViroObjectDetector     no passthrough camera access
 *   everything under components/AR/            ~30 VROAR* classes excluded from the target
 */

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Viro3DObject,
  ViroXRSceneNavigator,
  ViroAmbientLight,
  ViroBox,
  ViroButton,
  ViroDirectionalLight,
  ViroFlexView,
  ViroLightingEnvironment,
  ViroAnimations,
  ViroMaterials,
  ViroNode,
  ViroOmniLight,
  ViroParticleEmitter,
  ViroPolygon,
  ViroPolyline,
  ViroQuad,
  ViroScene,
  ViroSphere,
  ViroSpinner,
  ViroSpotLight,
  ViroText,
  ViroVisionOSModule,
} from "@reactvision/react-viro";

// ── Materials ────────────────────────────────────────────────────────────────
// Kept flat and unambiguous: a component that renders the wrong colour is a finding, and
// gradients or textures would make that ambiguous.

ViroMaterials.createMaterials({
  red:      { diffuseColor: "#E8000D" },
  green:    { diffuseColor: "#28A745" },
  blue:     { diffuseColor: "#0A84FF" },
  amber:    { diffuseColor: "#FFB000" },
  white:    { diffuseColor: "#FFFFFF" },
  constant: { diffuseColor: "#FFFFFF", lightingModel: "Constant" },
  // Two PBR endpoints rather than a sweep: metal-smooth and dielectric-rough are the pair that
  // makes a broken IBL obvious. Anything between them looks plausible when it is wrong.
  pbrMetal: { lightingModel: "PBR", diffuseColor: "#C0C0C0", metalness: 1.0, roughness: 0.15 },
  pbrRough: { lightingModel: "PBR", diffuseColor: "#B04030", metalness: 0.0, roughness: 0.85 },
});

// ── Animations ───────────────────────────────────────────────────────────────
// The animated box on page 3 referenced "spin" without this, so the name resolved to nothing and
// the page could not test animation at all. Found by running the sweep for the first time.

ViroAnimations.registerAnimations({
  spin: {
    properties: { rotateY: "+=90" },
    duration: 1000,
    easing: "Linear",
  },
});

const LABEL = { fontFamily: "Arial", fontSize: 12, color: "#FFFFFF" } as const;

/** Depth of every page. Chosen because objects nearer than ~1 m intersect the near plane and
 *  degrade the whole frame into a milky composite with passthrough — measured in session 16, and
 *  the single easiest way to make a working scene look broken. */
const Z = -2.0;

// ── Page 1 — primitives and geometry ─────────────────────────────────────────

function PagePrimitives() {
  return (
    <ViroNode position={[0, 0, Z]}>
      <ViroText text="1 · primitives" position={[0, 0.75, 0]} scale={[0.4, 0.4, 0.4]} style={LABEL} />

      <ViroBox    position={[-0.9, 0.2, 0]} scale={[0.3, 0.3, 0.3]} materials={["red"]} />
      <ViroSphere position={[-0.3, 0.2, 0]} radius={0.17} materials={["green"]} />
      <ViroQuad   position={[0.3, 0.2, 0]}  width={0.32} height={0.32} materials={["blue"]} />
      {/* ViroSurface is the same backend (VROSurface) reached through a second component; if one
          renders and the other does not, the bug is in the VRT layer, not the substrate. */}
      <ViroQuad   position={[0.9, 0.2, 0]}  width={0.32} height={0.32} materials={["amber"]} />

      {/* Polygon and polyline share poly2tri with vector text — a triangulation failure here and
          in ViroText together points at poly2tri, not at either component. */}
      <ViroPolygon
        position={[-0.6, -0.35, 0]}
        materials={["white"]}
        vertices={[[-0.2, -0.2], [0.2, -0.2], [0.25, 0.15], [0, 0.28], [-0.25, 0.15]]}
        holes={[]}
      />
      <ViroPolyline
        position={[0.5, -0.35, 0]}
        materials={["constant"]}
        points={[[-0.3, -0.15, 0], [-0.1, 0.15, 0], [0.1, -0.15, 0], [0.3, 0.15, 0]]}
        thickness={0.02}
      />

      <ViroFlexView
        position={[0, -0.8, 0]}
        width={1.2}
        height={0.2}
        style={{ flexDirection: "row", backgroundColor: "#202020" }}
      >
        <ViroText text="FlexView" style={LABEL} />
      </ViroFlexView>
    </ViroNode>
  );
}

// ── Page 2 — text, images, models ────────────────────────────────────────────

function PageContent() {
  return (
    <ViroNode position={[0, 0, Z]}>
      <ViroText text="2 · text + models" position={[0, 0.75, 0]} scale={[0.4, 0.4, 0.4]} style={LABEL} />

      {/* Three sizes: the glyph atlas is minified far more often than magnified, and the mip
          chain regenerated in VROGlyphAtlasMetal::refreshTexture is what the small line tests. */}
      <ViroText text="Regular 24" position={[0, 0.35, 0]}  scale={[0.5, 0.5, 0.5]}
                style={{ ...LABEL, fontSize: 24 }} />
      <ViroText text="Small 10 — mip chain" position={[0, 0.1, 0]} scale={[0.5, 0.5, 0.5]}
                style={{ ...LABEL, fontSize: 10 }} />
      {/* Accented + non-Latin: exercises the charmap coverage path, not just ASCII. */}
      <ViroText text="Ñandú · 日本語" position={[0, -0.15, 0]} scale={[0.5, 0.5, 0.5]}
                style={{ ...LABEL, fontSize: 18 }} />

      {/* GLB only. VROFBXLoader is excluded (protobuf), so an .fbx here would fail to load and
          the failure would look like a broken component. */}
      <Viro3DObject
        source={require("./assets/shiba.glb")}
        position={[0, -0.6, 0]}
        scale={[0.25, 0.25, 0.25]}
        type="GLB"
      />
    </ViroNode>
  );
}

// ── Page 3 — particles and animation ─────────────────────────────────────────

function PageMotion() {
  return (
    <ViroNode position={[0, 0, Z]}>
      <ViroText text="3 · particles + animation" position={[0, 0.75, 0]} scale={[0.4, 0.4, 0.4]} style={LABEL} />

      {/* maxParticles kept low: this page is a correctness check, and a heavy emitter would
          confound it with the frame-budget question that page 4 and the timer answer. */}
      <ViroParticleEmitter
        position={[-0.5, -0.2, 0]}
        duration={4000}
        visible
        run
        loop
        fixedToEmitter={false}
        image={{
          source: require("./assets/particle.png"),
          height: 0.05,
          width: 0.05,
          bloomThreshold: 0.0,
        }}
        spawnBehavior={{
          particleLifetime: [1500, 2500],
          emissionRatePerSecond: [20, 30],
          spawnVolume: { shape: "box", params: [0.2, 0.05, 0.2] },
          maxParticles: 120,
        }}
        particleAppearance={{
          opacity: { initialRange: [0, 1], factor: "time", interpolation: [{ endValue: 0, interval: [1500, 2500] }] },
          scale:   { initialRange: [[0.05, 0.05, 0.05], [0.08, 0.08, 0.08]] },
        }}
      />

      <ViroSpinner position={[0.5, 0.1, 0]} scale={[0.3, 0.3, 0.3]} />

      {/* Animated transform through VROTransaction — the same machinery ViroAnimatedComponent
          drives, exercised without the extra wrapper. */}
      <ViroBox
        position={[0.5, -0.45, 0]}
        scale={[0.2, 0.2, 0.2]}
        materials={["amber"]}
        animation={{ name: "spin", run: true, loop: true }}
      />
    </ViroNode>
  );
}

// ── Page 4 — lights, shadows, IBL ────────────────────────────────────────────
// The page most likely to move the frame budget: shadow map pass + IBL + PBR all at once.
// Run it with VIRO_FRAME_TIMING=1 and read the per-pass breakdown.

function PageLighting() {
  return (
    <ViroNode position={[0, 0, Z]}>
      <ViroText text="4 · lights + shadows + IBL" position={[0, 0.75, 0]} scale={[0.4, 0.4, 0.4]} style={LABEL} />

      <ViroLightingEnvironment source={require("./assets/env.hdr")} />
      <ViroAmbientLight color="#404040" />
      <ViroOmniLight position={[-1, 0.5, 0.5]} color="#4080FF" attenuationStartDistance={0.5} attenuationEndDistance={4} />
      <ViroDirectionalLight direction={[0, -1, -0.2]} color="#FFFFFF" />
      {/* castsShadow is the whole point of this page: the shadow pass needed Metal-convention
          projection math (z ∈ [0,1]) — with the OpenGL matrices the map came back empty. */}
      <ViroSpotLight
        position={[0, 2, 1]}
        direction={[0, -1, -0.3]}
        color="#FFFFFF"
        innerAngle={5}
        outerAngle={45}
        castsShadow
        shadowOpacity={0.7}
      />

      <ViroSphere position={[-0.4, 0.1, 0]} radius={0.2} materials={["pbrMetal"]} />
      <ViroSphere position={[0.4, 0.1, 0]}  radius={0.2} materials={["pbrRough"]} />

      {/* Shadow receiver. Without a surface underneath, a working shadow pass is invisible and
          reads as a failure. */}
      <ViroQuad
        position={[0, -0.5, 0]}
        rotation={[-90, 0, 0]}
        width={2}
        height={2}
        materials={["white"]}
        arShadowReceiver={false}
      />
    </ViroNode>
  );
}

// ── Page 5 — input, expected to work ─────────────────────────────────────────
//
// This page used to read "expected INERT": it was written before input reached JavaScript, when a
// tap here would have been the surprise. That landed on 2026-08-26 and was confirmed on device, so
// the expectation is inverted — a tap that does *not* register is now the finding.
//
// Note this is the Simulator's one blind spot in the whole sweep: it has no hand tracking and says
// so on startup, so page 5 can only be judged on hardware.

function PageInput() {
  const [tapped, setTapped] = useState(0);
  return (
    <ViroNode position={[0, 0, Z]}>
      <ViroText text="5 · input — expected to RESPOND" position={[0, 0.75, 0]} scale={[0.4, 0.4, 0.4]} style={LABEL} />
      <ViroText
        text={`taps registered: ${tapped}\nexpected: rises on device, stays 0 in the Simulator`}
        position={[0, 0.4, 0]}
        scale={[0.35, 0.35, 0.35]}
        style={LABEL}
      />

      {/* Both should respond to a pinch on hardware, and both should show the system hover
          highlight: the renderer registers a tracking area for any node with onHover, onClick or
          onDrag. A component that takes the click but never highlights is a finding on its own. */}
      <ViroButton
        position={[-0.35, -0.1, 0]}
        height={0.3}
        width={0.3}
        source={require("./assets/button.png")}
        onClick={() => setTapped((n) => n + 1)}
      />
      <ViroBox
        position={[0.35, -0.1, 0]}
        scale={[0.25, 0.25, 0.25]}
        materials={["blue"]}
        onClick={() => setTapped((n) => n + 1)}
      />
    </ViroNode>
  );
}

// ── Scene host ───────────────────────────────────────────────────────────────

const PAGES = [PagePrimitives, PageContent, PageMotion, PageLighting, PageInput] as const;

type SweepSceneProps = { sceneNavigator?: { viroAppProps?: { page: number } } };

export function ViroVisionOSSweepScene(props: SweepSceneProps) {
  const page = props.sceneNavigator?.viroAppProps?.page ?? 0;
  const Page = PAGES[page] ?? PAGES[0];
  return (
    <ViroScene>
      {/* Every page gets a floor of ambient light so that a component failing to render is
          distinguishable from a component rendering unlit. */}
      <ViroAmbientLight color="#303030" />
      <Page />
    </ViroScene>
  );
}

// ── 2D control panel ─────────────────────────────────────────────────────────

/** The renderer feature flags the navigator forwards. They double as the cost-attribution
 *  control the frame timer falls back to when per-pass GPU counters are unavailable: toggle one,
 *  read the GPU total, take the difference. Defaults are everything on except MSAA, which the M6
 *  ticket gates behind a confirmed budget. */
const DEFAULT_FEATURES = {
  hdrEnabled: true,
  pbrEnabled: true,
  bloomEnabled: true,
  shadowsEnabled: true,
  multisamplingEnabled: false,
} as const;

type FeatureKey = keyof typeof DEFAULT_FEATURES;

export default function ViroVisionOSSweep() {
  const [page, setPage] = useState(0);
  const [immersive, setImmersive] = useState(false);
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({ ...DEFAULT_FEATURES });

  const toggle = async () => {
    const ok = immersive
      ? await ViroVisionOSModule.exitImmersiveSpace()
      : await ViroVisionOSModule.enterImmersiveSpace("mixed");
    if (ok) setImmersive(!immersive);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>visionOS component sweep</Text>
      <Text style={styles.hint}>
        Set VIRO_FRAME_TIMING=1 before launching to get the per-pass breakdown in the log.
      </Text>

      <TouchableOpacity style={styles.primary} onPress={toggle}>
        <Text style={styles.primaryText}>
          {immersive ? "Exit immersive space" : "Enter immersive space"}
        </Text>
      </TouchableOpacity>

      <View style={styles.row}>
        {(Object.keys(DEFAULT_FEATURES) as FeatureKey[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.page, features[key] && styles.featureOn]}
            onPress={() => setFeatures((f) => ({ ...f, [key]: !f[key] }))}
          >
            <Text style={styles.pageText}>{key.replace("Enabled", "")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        {["primitives", "content", "motion", "lighting", "input"].map((name, i) => (
          <TouchableOpacity
            key={name}
            style={[styles.page, page === i && styles.pageActive]}
            onPress={() => setPage(i)}
          >
            <Text style={styles.pageText}>{`${i + 1} ${name}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {immersive && (
        <ViroXRSceneNavigator
          vrInitialScene={{ scene: ViroVisionOSSweepScene as any }}
          viroAppProps={{ page }}
          debug={false}
          onExitViro={() => setImmersive(false)}
          hdrEnabled={features.hdrEnabled}
          pbrEnabled={features.pbrEnabled}
          bloomEnabled={features.bloomEnabled}
          shadowsEnabled={features.shadowsEnabled}
          multisamplingEnabled={features.multisamplingEnabled}
          style={styles.nav}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#101014" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "600", marginBottom: 4 },
  hint: { color: "#8E8E93", fontSize: 13, marginBottom: 20 },
  primary: { backgroundColor: "#0A84FF", borderRadius: 10, padding: 14, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", marginTop: 20, gap: 8 },
  page: { backgroundColor: "#1C1C1E", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  pageActive: { backgroundColor: "#E8000D" },
  featureOn: { backgroundColor: "#28A745" },
  pageText: { color: "#FFFFFF", fontSize: 13 },
  nav: { flex: 1, marginTop: 20 },
});
