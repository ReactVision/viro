# ReactViro Shader Reference

Complete reference for custom shaders in ReactViro using shader modifiers.
Covers usage, all entry points, built-in features, extended API, and troubleshooting.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Shader Entry Points](#shader-entry-points)
4. [Scene Depth Buffer (`requiresSceneDepth`)](#scene-depth-buffer)
5. [Camera Texture (`requiresCameraTexture`)](#camera-texture)
6. [Screen-Space UV from `_surface.position`](#screen-space-uv)
7. [Custom Sampler Uniforms](#custom-sampler-uniforms)
8. [Custom Varyings Between Stages](#custom-varyings)
9. [GLSL ES Syntax](#glsl-es-syntax)
10. [Available Variables](#available-variables)
11. [Uniforms — Declaring, Setting, Updating](#uniforms)
12. [Applying Shaders to 3D Models](#applying-shaders-to-3d-models)
13. [TypeScript Types](#typescript-types)
14. [Modifier Priority / Ordering](#modifier-priority)
15. [Blend Modes](#blend-modes)
16. [ViroPolygon with Shaders](#viropolygon-with-shaders)
17. [Common Patterns](#common-patterns)
18. [Complete Examples](#complete-examples)
19. [Shader Creation Guidelines](#shader-creation-guidelines)
20. [Troubleshooting](#troubleshooting)
21. [Known Issues](#known-issues)
22. [Implementation Status](#implementation-status)

---

## Introduction

Shader modifiers inject custom GLSL code into ReactViro's rendering pipeline at specific entry points, enabling:

- Vertex displacement (wobbling, waving geometry)
- Custom material properties (holographic, scanlines, toon shading)
- Fragment effects (plasma, distortion, color grading)
- Custom lighting models and BRDF
- Scene depth buffer access (heat maps, edge detection, soft particles)
- Live camera feed effects (night vision, thermal, magnifying glass, refraction)
- Multi-texture effects via custom sampler uniforms

Shaders are written in **GLSL ES 3.0** and injected at predefined pragma points in ReactViro's shader pipeline.

### Live Demo Scenes (in Showcase)

- **custom-shaders.tsx** — Shiba Dynamax Effect: rim lighting, plasma sphere, dynamic shader switching with `shaderOverrides`
- **ar-vrx-animated.tsx** — Mystic Dragon VRX: cosmic portal shader, cel/toon shading, skeletal animation + shaders
- **ar-apple-effect.tsx** — AR Plane Effect: animated grid shader on ViroPolygon, cosmic portal fill, depth occlusion
- **shader-features.tsx** — Buffer Access: `requiresSceneDepth` (depth heat map, edge detection) + `requiresCameraTexture` (night vision, thermal, pixelation) on ViroQuads and ViroSpheres

---

## Quick Start

```javascript
import { ViroMaterials } from '@reactvision/react-viro';

ViroMaterials.createMaterials({
  myMaterial: {
    lightingModel: "Constant",
    diffuseColor: "#4ADE80",
    shaderModifiers: {
      surface: `
        uniform highp float time;
        _surface.diffuse_color.rgb *= vec3(0.5 + 0.5 * sin(time * 0.001));
      `
    }
  }
});
```

**Key rules:**
1. All `float` types need precision qualifiers: `lowp`, `mediump`, or `highp`
2. Use template literals (backticks) for multiline shaders
3. **Always declare uniforms before using them — missing declarations cause immediate crashes**
4. Avoid reserved single-letter names: `t` (tangent), `n` (normal), `b` (binormal), `v`

---

## Shader Entry Points

Six entry points are available in the rendering pipeline:

### 1. `geometry` — Vertex Position (Pre-Transform) ✅

Modifies vertex positions and normals before model-view-projection transformation.

**Use for:** Vertex displacement, morphing, procedural deformation.

**Available variables:**
```glsl
vec4 _geometry.position;    // Vertex position in model space (read/write)
vec3 _geometry.normal;      // Vertex normal in model space (read/write)
vec4 _geometry.tangent;     // Vertex tangent (w = handedness)
vec4 _geometry.bone_weights;
ivec4 _geometry.bone_indices;
vec2 _geometry.texcoord;
mat4 _transforms.model_matrix;
mat4 _transforms.view_matrix;
mat4 _transforms.projection_matrix;
```

```javascript
geometry: `
  uniform highp float time;
  uniform highp float amplitude;

  highp float wave = sin(_geometry.position.y * 10.0 + time * 0.005) * amplitude;
  _geometry.position.x += wave;
  _geometry.position.z += wave;
  _geometry.normal = normalize(_geometry.normal + vec3(wave, 0.0, wave));
`
```

---

### 2. `vertex` — Post-Transform Vertex ⚠️

Modifies vertex attributes after transformation to screen space.

**Available:** `_vertex.position` (vec3, NDC, read/write)

Mostly untested — prefer `geometry` for vertex work.

---

### 3. `surface` — Material Properties ✅ Recommended

Modifies surface properties before lighting calculations. The most versatile and tested entry point.

**Use for:** Texture blending, procedural materials, color effects, transparency, screen-space sampling (depth, camera).

**Available variables:**
```glsl
vec4  _surface.diffuse_color;        // RGBA — write to change color/alpha
vec2  _surface.diffuse_texcoord;     // Object UV coordinates
float _surface.diffuse_intensity;
vec3  _surface.specular_color;
float _surface.shininess;
float _surface.roughness;            // PBR
float _surface.metalness;            // PBR
float _surface.ao;                   // Ambient occlusion
float _surface.alpha;
vec3  _surface.normal;               // Surface normal in world space
vec3  _surface.position;             // Surface position in world space ← key for screen UV
vec3  _surface.view;                 // View direction (see Known Issues)
```

**Standard uniforms always bound (just declare them):**
```glsl
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;
uniform highp mat4 model_matrix;
uniform highp mat4 normal_matrix;
uniform highp vec3 camera_position;
```

---

### 4. `lightingModel` — Custom Lighting ✅

Replaces/modifies lighting calculations per light source.

**Use for:** Toon shading, custom Fresnel, rim lighting, custom BRDF.

**Available:**
```glsl
vec3  _lightingContribution.ambient;
vec3  _lightingContribution.diffuse;
vec3  _lightingContribution.specular;
float _lightingContribution.visibility;  // multiply diffuse/specular
// plus all _surface.* and _light.* uniforms
```

```javascript
lightingModel: `
  highp float intensity = dot(_surface.normal, normalize(vec3(0.0, 1.0, 0.0)));
  if      (intensity > 0.95) intensity = 1.0;
  else if (intensity > 0.50) intensity = 0.6;
  else if (intensity > 0.25) intensity = 0.4;
  else                       intensity = 0.2;
  _lightingContribution.diffuse = _light.color * intensity;
`
```

---

### 5. `fragment` — Final Pixel Output ✅

Modifies the final color after lighting via `_output_color`.

**⚠️ Write to `_output_color`, NOT `frag_color`.** The fragment pragma sits before the final `frag_color = _output_color` assignment — writing to `frag_color` directly gets overwritten.

```glsl
// ❌ Gets overwritten
fragment: `frag_color.rgb = vec3(1.0, 0.0, 0.0);`

// ✅ Correct
fragment: `_output_color.rgb = vec3(1.0, 0.0, 0.0);`
```

**Prefer `surface` for most effects** — it runs before lighting, is more predictable, and works with all lighting models especially `"Constant"`.

---

### 6. `image` — Post-Processing ⚠️

2D image-space post-processing. Writes to `frag_color`. Mostly untested.

---

### Entry Point Summary

| Entry Point | Status | Best For |
|------------|--------|---------|
| `geometry` | ✅ Working | Vertex displacement, morphing |
| `vertex` | ⚠️ Untested | Post-transform vertex effects |
| `surface` | ✅ **Recommended** | Colors, materials, depth/camera sampling |
| `lightingModel` | ✅ Working | Custom BRDF, toon shading |
| `fragment` | ✅ Working* | Post-lighting tweaks (use `_output_color`) |
| `image` | ⚠️ Untested | 2D post-processing |

---

## Scene Depth Buffer

Set `requiresSceneDepth: true` on a modifier and the engine automatically binds the previous frame's depth buffer to `uniform sampler2D scene_depth_texture`.

> Requires HDR rendering. Available on iOS (LiDAR) and Android (ARCore depth API).

The **red channel** holds normalized depth: `0.0` = near plane, `1.0` = far plane/background.

**Requires the object format** (see [Uniforms](#uniforms)).

### Getting Screen UVs to Sample Depth

The depth texture is screen-aligned — use screen-space UVs computed from `_surface.position`:

```glsl
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;

highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
highp vec2 uv   = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
highp float d   = texture(scene_depth_texture, uv).r;
```

### Depth Heat Map

```javascript
ViroMaterials.createMaterials({
  depthHeatMap: {
    lightingModel: "Constant",
    cullMode: "None",
    blendMode: "Alpha",
    shaderModifiers: {
      surface: {
        uniforms: `uniform sampler2D scene_depth_texture;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
        body: `
          highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
          highp vec2 uv   = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
          highp float d   = texture(scene_depth_texture, uv).r;
          highp vec3 col;
          if      (d < 0.25) col = mix(vec3(0.0,0.0,1.0), vec3(0.0,1.0,1.0), d        * 4.0);
          else if (d < 0.50) col = mix(vec3(0.0,1.0,1.0), vec3(0.0,1.0,0.0), (d-0.25)* 4.0);
          else if (d < 0.75) col = mix(vec3(0.0,1.0,0.0), vec3(1.0,1.0,0.0), (d-0.50)* 4.0);
          else               col = mix(vec3(1.0,1.0,0.0), vec3(1.0,0.0,0.0), (d-0.75)* 4.0);
          _surface.diffuse_color = vec4(col, 0.92);
        `,
        requiresSceneDepth: true,
      } as ShaderMod,
    },
  },
});
```

### Depth Edge Detection

```javascript
depthEdges: {
  lightingModel: "Constant",
  cullMode: "None",
  blendMode: "Alpha",
  shaderModifiers: {
    surface: {
      uniforms: `uniform sampler2D scene_depth_texture;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
      body: `
        highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
        highp vec2 uv   = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
        highp float px  = 0.003;
        highp float d   = texture(scene_depth_texture, uv).r;
        highp float dX  = texture(scene_depth_texture, uv + vec2(px, 0.0)).r;
        highp float dY  = texture(scene_depth_texture, uv + vec2(0.0, px)).r;
        highp float e   = clamp(length(vec2(d - dX, d - dY)) * 30.0, 0.0, 1.0);
        _surface.diffuse_color = vec4(
          mix(vec3(0.04, 0.04, 0.12), vec3(0.1, 1.0, 0.9), e),
          0.85 + e * 0.15
        );
      `,
      requiresSceneDepth: true,
    } as ShaderMod,
  },
},
```

---

## Camera Texture

Set `requiresCameraTexture: true` and the engine automatically binds:
- `uniform sampler2D camera_texture` — the live AR camera feed
- `uniform mat4 camera_image_transform` — UV transform from screen coordinates to camera image space

**Always declare as `sampler2D`.** On Android the engine injects `#extension GL_OES_EGL_image_external_essl3` and replaces the sampler type automatically. Never declare `samplerExternalOES` yourself — it crashes on iOS.

**Always apply `camera_image_transform`** before sampling — raw screen UVs will be distorted by device orientation and aspect ratio:

```glsl
highp vec2 cameraUV = (camera_image_transform * vec4(screenUV, 0.0, 1.0)).xy;
highp vec4 cam = texture(camera_texture, cameraUV);
```

### Night Vision

```javascript
cameraNightVision: {
  lightingModel: "Constant",
  cullMode: "None",
  shaderModifiers: {
    surface: {
      uniforms: `uniform sampler2D camera_texture;
uniform highp mat4 camera_image_transform;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
      body: `
        highp vec4 clip     = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
        highp vec2 screenUV = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
        highp vec2 uv       = (camera_image_transform * vec4(screenUV, 0.0, 1.0)).xy;
        highp vec4 cam      = texture(camera_texture, uv);
        highp float lum     = dot(cam.rgb, vec3(0.299, 0.587, 0.114));
        highp float g       = pow(clamp(lum * 1.4, 0.0, 1.0), 0.75);
        _surface.diffuse_color = vec4(0.04, g, 0.04 + g * 0.12, 1.0);
      `,
      requiresCameraTexture: true,
    } as ShaderMod,
  },
},
```

### Thermal Imaging

```javascript
cameraThermal: {
  lightingModel: "Constant",
  cullMode: "None",
  shaderModifiers: {
    surface: {
      uniforms: `uniform sampler2D camera_texture;
uniform highp mat4 camera_image_transform;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
      body: `
        highp vec4 clip     = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
        highp vec2 screenUV = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
        highp vec2 uv       = (camera_image_transform * vec4(screenUV, 0.0, 1.0)).xy;
        highp vec4 cam      = texture(camera_texture, uv);
        highp float t       = dot(cam.rgb, vec3(0.299, 0.587, 0.114));
        highp vec3 th;
        if      (t < 0.25) th = mix(vec3(0.0,0.0,0.0), vec3(0.5,0.0,0.7), t        * 4.0);
        else if (t < 0.50) th = mix(vec3(0.5,0.0,0.7), vec3(1.0,0.0,0.0), (t-0.25)* 4.0);
        else if (t < 0.75) th = mix(vec3(1.0,0.0,0.0), vec3(1.0,0.7,0.0), (t-0.50)* 4.0);
        else               th = mix(vec3(1.0,0.7,0.0), vec3(1.0,1.0,1.0), (t-0.75)* 4.0);
        _surface.diffuse_color = vec4(th, 1.0);
      `,
      requiresCameraTexture: true,
    } as ShaderMod,
  },
},
```

### Animated Pixelate + Hue Shift

```javascript
cameraPixelate: {
  lightingModel: "Constant",
  cullMode: "None",
  shaderModifiers: {
    surface: {
      uniforms: `uniform sampler2D camera_texture;
uniform highp mat4 camera_image_transform;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;
uniform highp float time;`,
      body: `
        highp vec4 clip     = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
        highp vec2 screenUV = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
        highp float blocks  = 20.0 + sin(time * 0.001) * 8.0;
        highp vec2 rawUV    = (floor(screenUV * blocks) + 0.5) / blocks;
        highp vec2 uv       = (camera_image_transform * vec4(rawUV, 0.0, 1.0)).xy;
        highp vec4 cam      = texture(camera_texture, uv);
        highp float angle   = time * 0.0008;
        highp float ca = cos(angle), sa = sin(angle);
        highp vec3 k   = vec3(0.2126, 0.7152, 0.0722);
        highp float l  = dot(cam.rgb, k);
        highp vec3 col = cam.rgb * ca + l * (1.0 - ca) * vec3(1.0) + cross(k, cam.rgb) * sa;
        _surface.diffuse_color = vec4(clamp(col, 0.0, 1.0), 1.0);
      `,
      requiresCameraTexture: true,
    } as ShaderMod,
  },
},
```

Drive animation from JS:
```javascript
useEffect(() => {
  const id = setInterval(() => {
    ViroMaterials.updateShaderUniform("cameraPixelate", "time", "float", Date.now() % 1_000_000);
  }, 16);
  return () => clearInterval(id);
}, []);
```

### Glass Refraction (Camera + Normal Map)

```javascript
refractiveGlass: {
  lightingModel: "Constant",
  blendMode: "Alpha",
  shaderModifiers: {
    surface: {
      uniforms: `uniform sampler2D camera_texture;
uniform highp mat4 camera_image_transform;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
      body: `
        highp vec4 clip     = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
        highp vec2 screenUV = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
        // Offset by surface normal for refraction
        highp vec2 offset   = _surface.normal.xy * 0.05;
        highp vec2 uv       = (camera_image_transform * vec4(screenUV + offset, 0.0, 1.0)).xy;
        highp vec4 refracted = texture(camera_texture, uv);
        // Tinted glass blend
        _surface.diffuse_color = mix(refracted, vec4(0.6, 0.8, 1.0, 1.0), 0.2);
        _surface.alpha = 0.9;
      `,
      requiresCameraTexture: true,
    } as ShaderMod,
  },
},
```

---

## Screen-Space UV

Computing screen-space UVs is needed to sample any screen-aligned texture (depth buffer, camera feed) from within a `surface` modifier.

```glsl
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;

// Project world position to clip space
highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);

// Perspective divide → NDC [-1,1], remap to UV [0,1]
highp vec2 screenUV = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
```

`_surface.position` is the world-space position of the current fragment — always available in the `surface` modifier. `view_matrix` and `projection_matrix` are standard uniforms the engine always binds — just declare them.

**Why NOT to use `varyings` for screen UV:** Using a geometry modifier + varying to pass screen UV is fragile. If the deployed binary doesn't have `#pragma varying_out_declarations` / `#pragma varying_in_declarations` compiled in, the declaration is silently dropped → undeclared variable → crash. The `_surface.position` approach is safe everywhere. See [Custom Varyings](#custom-varyings) for the proper varyings API.

---

## Custom Sampler Uniforms

Modifier code can declare any `uniform sampler2D` and bind it via `materialUniforms`. This enables noise textures, LUTs, custom masks, detail textures, and any multi-texture technique.

```javascript
ViroMaterials.createMaterials({
  noisyMetal: {
    lightingModel: "PBR",
    diffuseColor: "#888888",
    shaderModifiers: {
      surface: {
        uniforms: "uniform sampler2D noise_tex;",
        body: `
          highp float noise = texture(noise_tex, _surface.diffuse_texcoord * 3.0).r;
          _surface.roughness = mix(0.2, 0.9, noise);
          _surface.metalness = mix(0.4, 1.0, noise);
        `
      }
    },
    materialUniforms: [
      { name: "noise_tex", type: "sampler2D", value: require("./textures/noise.png") }
    ]
  }
});
```

**Runtime texture swap:**

```javascript
ViroMaterials.updateShaderUniform(
  "noisyMetal", "noise_tex", "sampler2D", require("./textures/noise2.png")
);
```

### LUT Color Grading

```javascript
ViroMaterials.createMaterials({
  colorGraded: {
    diffuseTexture: require("./scene.png"),
    shaderModifiers: {
      fragment: {
        uniforms: "uniform sampler2D lut_tex;",
        body: `
          highp vec3 color = _output_color.rgb;
          highp float r = texture(lut_tex, vec2(color.r, 0.5)).r;
          highp float g = texture(lut_tex, vec2(color.g, 0.5)).g;
          highp float b = texture(lut_tex, vec2(color.b, 0.5)).b;
          _output_color = vec4(r, g, b, _output_color.a);
        `
      }
    },
    materialUniforms: [
      { name: "lut_tex", type: "sampler2D", value: require("./lut_day.png") }
    ]
  }
});

// Swap LUT at runtime (e.g. day/night)
ViroMaterials.updateShaderUniform(
  "colorGraded", "lut_tex", "sampler2D",
  isDaytime ? require("./lut_day.png") : require("./lut_night.png")
);
```

---

## Custom Varyings

The `varyings` field lets a `geometry` modifier (vertex stage) pass typed variables to a `surface` or `fragment` modifier (fragment stage).

> **⚠️ Crash warning:** Varyings depend on the deployed binary having `#pragma varying_out_declarations` and `#pragma varying_in_declarations` compiled into the GLSL templates. If those pragmas are absent (older binary), the declaration is **silently dropped** → undeclared identifier → GLSL compile crash. Use `_surface.position` + matrix math as a crash-safe alternative wherever possible.

```typescript
ViroMaterials.createMaterials({
  displacedRough: {
    lightingModel: "PBR",
    diffuseColor: "#4488FF",
    shaderModifiers: {
      geometry: {
        varyings: ["highp float displacement_amount"],
        uniforms: "uniform highp float time;",
        body: `
          highp float wave = sin(_geometry.position.x * 4.0 + time) * 0.1;
          _geometry.position.y += wave;
          displacement_amount = abs(wave) / 0.1;
        `,
      } as ShaderMod,
      surface: {
        varyings: ["highp float displacement_amount"],
        body: `
          _surface.roughness = mix(0.1, 0.9, displacement_amount);
        `
      } as ShaderMod,
    },
    materialUniforms: [{ name: "time", type: "float", value: 0.0 }]
  }
});
```

The same varying name declared in both `geometry` and `surface`/`fragment` is treated as a matched pair — the engine injects `out` in the vertex stage and `in` in the fragment stage.

---

## GLSL ES Syntax

### Precision Qualifiers (Required)

```glsl
uniform highp float time;      // positions, time, matrices → highp
uniform mediump vec3 color;    // colors, normals → mediump
uniform lowp vec4 output;      // final output colors → lowp

highp vec3 position;
mediump vec2 texcoord;
lowp vec4 finalColor;
```

### Common Rules

```glsl
// ✅ Correct
highp vec3 color = vec3(1.0, 0.5, 0.0);  // use .0 on float literals
highp float d = length(uv - 0.5);
highp vec3 n = normalize(normal);

// ❌ Wrong
vec3 color = vec3(1, 0.5, 0);  // missing precision + missing .0
uniform float time;             // missing precision qualifier
```

### Reserved Variable Names — Do Not Use

ReactViro's shader templates use these names internally:

| Name | Internal use |
|------|-------------|
| `t`  | Tangent vector |
| `n`  | Normal vector |
| `b`  | Binormal/bitangent |
| `v`  | Varyings prefix |
| `frag_color` | Fragment output — use `_output_color` in fragment modifier |

```glsl
// ❌ CRASH — 't' conflicts with tangent
highp float t = time * 0.001;

// ✅ SAFE
highp float animTime = time * 0.001;
```

---

## Available Variables

### Geometry Entry Point

```glsl
vec4 _geometry.position;     // model space (read/write)
vec3 _geometry.normal;       // model space (read/write)
vec4 _geometry.tangent;
vec4 _geometry.bone_weights;
ivec4 _geometry.bone_indices;
vec2 _geometry.texcoord;
mat4 _transforms.model_matrix;
mat4 _transforms.view_matrix;
mat4 _transforms.projection_matrix;
```

### Surface Entry Point

```glsl
vec4  _surface.diffuse_color;
vec2  _surface.diffuse_texcoord;
float _surface.diffuse_intensity;
vec3  _surface.specular_color;
float _surface.shininess;
float _surface.roughness;
float _surface.metalness;
float _surface.ao;
float _surface.alpha;
vec3  _surface.normal;      // world space
vec3  _surface.position;    // world space ← use for screen UV
vec3  _surface.view;        // see Known Issues
```

### Fragment Entry Point

```glsl
highp vec4 _output_color;   // read/write — do NOT use frag_color
```

### Standard Uniforms (engine always binds — declare to use)

```glsl
uniform highp mat4 model_matrix;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;
uniform highp mat4 normal_matrix;
uniform highp vec3 camera_position;
uniform highp vec4 material_diffuse_surface_color;
uniform highp float material_diffuse_intensity;
uniform highp float material_alpha;
uniform highp float material_shininess;
```

### Special Auto-Bound Uniforms

| Uniform | Type | Flag required |
|---------|------|--------------|
| `scene_depth_texture` | `sampler2D` | `requiresSceneDepth: true` |
| `camera_texture` | `sampler2D` | `requiresCameraTexture: true` |
| `camera_image_transform` | `mat4` | `requiresCameraTexture: true` |

---

## Uniforms

### String vs Object Format

```javascript
// String format — simple cases, uniforms declared inline
surface: `
  uniform highp float time;
  _surface.diffuse_color.rgb *= sin(time * 0.001);
`

// Object format — required for requiresSceneDepth / requiresCameraTexture / varyings
surface: {
  uniforms: `uniform sampler2D scene_depth_texture;
uniform highp mat4 view_matrix;
uniform highp mat4 projection_matrix;`,
  body: `
    highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
    highp vec2 uv   = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
    highp float d   = texture(scene_depth_texture, uv).r;
    _surface.diffuse_color = vec4(vec3(d), 1.0);
  `,
  requiresSceneDepth: true,
}
```

In string format, uniform declarations at the top are automatically separated and placed in the correct shader section.

### Setting Values at Runtime

```javascript
ViroMaterials.updateShaderUniform('myMaterial', 'time',         'float',    Date.now());
ViroMaterials.updateShaderUniform('myMaterial', 'glow_color',   'vec3',     [1.0, 0.5, 0.0]);
ViroMaterials.updateShaderUniform('myMaterial', 'custom_color', 'vec4',     [1.0, 0.5, 0.0, 0.8]);
ViroMaterials.updateShaderUniform('myMaterial', 'transform',    'mat4',     [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
ViroMaterials.updateShaderUniform('myMaterial', 'noise_tex',    'sampler2D', require('./noise.png'));
```

**Animated uniforms pattern (~60fps):**

```javascript
useEffect(() => {
  const id = setInterval(() => {
    ViroMaterials.updateShaderUniform('myMaterial', 'time', 'float', Date.now() % 1_000_000);
  }, 16);
  return () => clearInterval(id);
}, []);
```

**Uniform update flow (internal):**

```
JS: ViroMaterials.updateShaderUniform("mat", "time", "float", value)
  ↓
Native (Java/ObjC): material.setShaderUniform("time", value)
  ↓ Android: async GL dispatch | iOS: synchronous
C++: material->_shaderUniformFloats["time"] = value
  ↓
Render frame: VROMaterialShaderBinding::bindMaterialUniforms()
  → glUniform1f(location, value)
```

---

## Applying Shaders to 3D Models

### `materials` — Replaces All Materials

```tsx
// Replaces the model's textures entirely
<Viro3DObject source={require('./model.glb')} type="GLB" materials={["myShader"]} />
```

Use when you want to completely override the model's appearance.

### `shaderOverrides` — Preserves Original Textures ✅

```tsx
// Preserves the model's textures and adds shader effects on top
<Viro3DObject source={require('./model.glb')} type="GLB" shaderOverrides={["redGlow"]} />
```

Use when adding visual effects (glow, rim lighting, overlays) to textured models.

**How it works:** Model materials are cloned internally, shader modifiers are merged, `_surface.diffuse_color` starts with the original texture color. Applied recursively to all child nodes.

| | `materials` | `shaderOverrides` |
|--|------------|------------------|
| Original textures | ❌ Replaced | ✅ Preserved |
| `_surface.diffuse_color` initial | Material `diffuseColor` | Model's texture |
| Works with primitives | ✅ Yes | ⚠️ Use `materials` |

### Dynamic Shader Switching

```tsx
const [shader, setShader] = useState("blackWithRed");

useEffect(() => {
  if (animationPhase === "growing")  setShader("blackWithRed");
  if (animationPhase === "revealed") setShader("redEnergy");
}, [animationPhase]);

<Viro3DObject source={require('./shiba.glb')} type="GLB" shaderOverrides={[shader]} />
```

---

## TypeScript Types

All fields are part of the published `@reactvision/react-viro` types (defined in `ViroMaterials.ts`):

```typescript
export type ViroShaderModifier = {
  body?: string;                   // GLSL body (injected into the stage)
  uniforms?: string;               // Uniform declarations block
  /** Typed varying declarations shared between vertex and fragment stages.
   *  Each string is a GLSL type+name pair, e.g. "highp float displacement".
   *  The 'out' / 'in' qualifiers are added automatically.
   *  ⚠️ Crash risk on older binaries — prefer _surface.position + matrix math. */
  varyings?: string[];
  /** When true the modifier may declare and sample
   *  'uniform sampler2D scene_depth_texture'.
   *  The engine auto-binds the previous frame's scene depth buffer (HDR mode only). */
  requiresSceneDepth?: boolean;
  /** When true the modifier may declare and sample 'uniform sampler2D camera_texture'.
   *  The engine auto-binds the live AR camera background texture.
   *  On Android (ARCore) the OES extension and samplerExternalOES are injected automatically.
   *  A 'uniform mat4 camera_image_transform' is also auto-bound for UV mapping. */
  requiresCameraTexture?: boolean;
};

export type ViroShaderModifiers = {
  geometry?:      string | ViroShaderModifier;
  vertex?:        string | ViroShaderModifier;
  surface?:       string | ViroShaderModifier;
  fragment?:      string | ViroShaderModifier;
  lightingModel?: string | ViroShaderModifier;
};

export type ViroShaderUniform = {
  name: string;
  type: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D";
  value: number | number[] | ReturnType<typeof require>;
};
```

> **Note:** Some showcase files define a local `ShaderMod` augmented type and use `as ShaderMod` casts — this is a workaround for showcase projects whose installed `node_modules/@reactvision/react-viro` predates the type additions. The source package itself already has the full definition above.

---

## Modifier Priority

When multiple subsystems (AR shadow, custom effects, debug overlays) attach modifiers to the same material, ordering is deterministic via a priority system.

| Priority | Intended for |
|---|---|
| -100 | Engine internals (AR shadow, occlusion) |
| 0 | Default / user modifiers |
| 100 | Debug / overlay modifiers |

This is mostly transparent to React Native developers — it ensures engine-internal modifiers (like AR shadow) don't interfere with user-defined effects regardless of when `addShaderModifier` was called.

---

## Blend Modes

```javascript
ViroMaterials.createMaterials({
  glowParticle:  { diffuseTexture: require('./glow.png'),  lightingModel: "Constant", blendMode: "Add",      writesToDepthBuffer: false },
  smokeParticle: { diffuseTexture: require('./smoke.png'), lightingModel: "Constant", blendMode: "Alpha",    writesToDepthBuffer: false },
  scorchMark:    { diffuseTexture: require('./scorch.png'),lightingModel: "Constant", blendMode: "Multiply", writesToDepthBuffer: false },
});
```

| Blend Mode | Effect | Best for |
|------------|--------|----------|
| `"Add"` | Additive, brightens | Glows, sparks, energy |
| `"Alpha"` | Standard transparency | Smoke, clouds, UI |
| `"Multiply"` | Darkening blend | Shadows, scorch marks |
| `"Screen"` | Like Add but capped | Bright overlays |

**Always set `writesToDepthBuffer: false` for particles** to prevent depth sorting issues.

---

## ViroPolygon with Shaders

ViroPolygon supports shader modifiers, ideal for AR plane detection effects:

```javascript
ViroMaterials.createMaterials({
  planeDetection: {
    lightingModel: "Constant",
    blendMode: "Alpha",
    cullMode: "None",
    writesToDepthBuffer: false,
    shaderModifiers: {
      surface: `
        uniform highp float time;
        highp vec2 uv = _surface.diffuse_texcoord;
        highp float animTime = time * 0.001;
        highp float pulse = sin(animTime * 3.0) * 0.15 + 0.65;
        highp float gridScale = 10.0;
        highp float gridX = mod(uv.x * gridScale, 1.0);
        highp float gridY = mod(uv.y * gridScale, 1.0);
        highp float lineX = smoothstep(0.96, 1.0, gridX) + smoothstep(0.04, 0.0, gridX);
        highp float lineY = smoothstep(0.96, 1.0, gridY) + smoothstep(0.04, 0.0, gridY);
        highp float grid = max(lineX, lineY) * 0.5;
        highp vec3 color = vec3(0.3, 0.9, 1.0) + vec3(grid * 0.8);
        highp float dist = length(uv - 0.5);
        highp float fade = smoothstep(0.75, 0.35, dist);
        _surface.diffuse_color = vec4(color, pulse * fade);
      `
    }
  }
});
```

---

## Common Patterns

### Animated Vertex Displacement

```javascript
geometry: `
  uniform highp float time;
  uniform highp float amplitude;
  highp float wave = sin(_geometry.position.y * 10.0 + time * 0.005) * amplitude;
  _geometry.position.x += wave;
  _geometry.position.z += wave;
  _geometry.normal = normalize(_geometry.normal + vec3(wave, 0.0, wave));
`
```

### Holographic Effect

```javascript
surface: `
  uniform highp float time;
  highp float scan = sin(_surface.position.y * 50.0 + time * 0.01) * 0.5 + 0.5;
  _surface.diffuse_color.rgb *= (scan * 0.5 + 0.5);
  highp float lighting = dot(_surface.normal, normalize(vec3(0.5, 1.0, 0.5)));
  lighting = (lighting + 1.0) * 0.5;
  highp float edge = pow(1.0 - abs(lighting - 0.5) * 2.0, 3.0);
  _surface.diffuse_color.rgb += vec3(0.3, 0.6, 1.0) * edge;
  _surface.diffuse_color.a = 0.7;
`
```

### Rim Lighting (lighting-based, crash-safe)

```javascript
surface: `
  uniform highp vec3 rim_color;
  uniform highp float rim_power;
  highp float lighting = dot(_surface.normal, normalize(vec3(0.5, 1.0, 0.5)));
  lighting = (lighting + 1.0) * 0.5;
  highp float rim = pow(1.0 - abs(lighting - 0.5) * 2.0, rim_power);
  _surface.diffuse_color.rgb += rim_color * rim;
`
```

### Texture Blending

```javascript
surface: `
  uniform sampler2D overlay_texture;
  uniform highp float blend_factor;
  highp vec4 overlay = texture(overlay_texture, _surface.diffuse_texcoord);
  _surface.diffuse_color = mix(_surface.diffuse_color, overlay, blend_factor);
`
```

### UV Rotation

```javascript
surface: `
  uniform highp float time;
  highp float angle = time * 0.001;
  highp float s = sin(angle), c = cos(angle);
  highp vec2 centered = _surface.diffuse_texcoord - 0.5;
  _surface.diffuse_texcoord = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + 0.5;
`
```

### Toggling Between UV Modes

```javascript
const [useScreenUV, setUseScreenUV] = useState(true);
useEffect(() => {
  const val = useScreenUV ? 0.0 : 1.0;
  ["mat1", "mat2"].forEach(name =>
    ViroMaterials.updateShaderUniform(name, "u_use_geo_uv", "float", val)
  );
}, [useScreenUV]);
```

```glsl
uniform highp float u_use_geo_uv;
highp vec2 uv = u_use_geo_uv > 0.5 ? _surface.diffuse_texcoord : screenUV;
```

---

## Complete Examples

### Pulsing Glow Sphere

```javascript
pulsingSphere: {
  lightingModel: "Blinn",
  diffuseColor: "#FF6B9D",
  shaderModifiers: {
    surface: `
      uniform highp float time;
      highp float pulse = 0.5 + 0.5 * sin(time * 0.003);
      highp float lighting = dot(_surface.normal, normalize(vec3(0.5, 1.0, 0.5)));
      lighting = (lighting + 1.0) * 0.5;
      highp float edge = pow(1.0 - abs(lighting - 0.5) * 2.0, 2.0);
      _surface.diffuse_color.rgb *= pulse;
      _surface.diffuse_color.rgb += vec3(1.0, 0.4, 0.6) * edge * pulse;
    `
  }
}
```

### Waving Flag

```javascript
wavingFlag: {
  lightingModel: "Blinn",
  shaderModifiers: {
    geometry: `
      uniform highp float time;
      uniform highp float wind_strength;
      highp float wave = sin(_geometry.position.x * 3.0 + time * 0.005)
                       * cos(_geometry.position.x * 2.0 + time * 0.003)
                       * wind_strength * _geometry.position.x * 0.1;
      _geometry.position.y += wave;
      _geometry.position.z += wave * 0.5;
      _geometry.normal = normalize(_geometry.normal + vec3(0.0, wave, wave * 0.5));
    `
  }
}
```

### Plasma Energy Sphere

```javascript
plasmaEnergy: {
  lightingModel: "Constant",
  shaderModifiers: {
    surface: `
      uniform highp float time;
      highp vec2 uv = _surface.diffuse_texcoord;
      highp float animTime = time * 0.001;
      highp float p1 = sin(uv.x * 10.0 + animTime * 2.0) * cos(uv.y * 8.0 + animTime * 1.5);
      highp float p2 = sin((uv.x + uv.y) * 8.0 + animTime * 3.0);
      highp float p3 = sin(length(uv - 0.5) * 12.0 - animTime * 4.0);
      highp float energy = sin((p1 + p2 + p3) / 3.0 * 3.14159 + animTime * 2.0);
      highp vec3 col = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.5, 0.6), energy * 0.5 + 0.5);
      _surface.diffuse_color = vec4(col, 0.4 + abs(sin((p1+p2+p3)/3.0 * 4.0)) * 0.3);
    `
  }
}
```

### Cosmic Portal

```javascript
cosmicPortal: {
  lightingModel: "Constant",
  blendMode: "Alpha",
  cullMode: "None",
  shaderModifiers: {
    surface: `
      uniform highp float time;
      highp vec2 uv = _surface.diffuse_texcoord;
      highp float animTime = time * 0.0004;
      highp vec2 center = vec2(0.5, 0.5);
      highp float dist  = length(uv - center);
      highp float angle = atan(uv.y - center.y, uv.x - center.x);
      highp float spiral = angle + dist * 8.0 - animTime * 2.0;
      highp float nebula1 = sin(uv.x * 2.5 + animTime * 1.2) * cos(uv.y * 2.0 + animTime * 0.9);
      highp float nebula2 = sin(spiral * 3.0 + animTime) * cos(dist * 8.0 - animTime * 1.5);
      highp float aurora  = sin(uv.y * 10.0 + spiral * 2.0 + animTime * 2.5);
      highp vec3 col = vec3(0.05, 0.0, 0.15);
      col = mix(col, vec3(0.4, 0.1, 0.6), abs((nebula1+nebula2)*0.5) * 0.6);
      col = mix(col, vec3(0.2, 0.7, 0.9), abs(aurora) * 0.45);
      col += vec3(1.0, 0.8, 0.3) * smoothstep(0.4, 0.0, dist) * 0.6;
      highp float star = pow(max(sin(uv.x*80.0+animTime*0.5)*sin(uv.y*80.0+animTime*0.4),0.0),30.0)*2.0;
      col += vec3(star);
      highp float vignette = 1.0 - smoothstep(0.4, 0.78, dist);
      _surface.diffuse_color = vec4(col, 0.92 * vignette * smoothstep(0.82, 0.70, dist));
    `
  }
}
```

### Cel/Toon Shading with Rim

```javascript
celShaded: {
  lightingModel: "Constant",
  shaderModifiers: {
    surface: `
      uniform highp float time;
      highp float lighting = (dot(_surface.normal, normalize(vec3(0.5, 1.0, 0.5))) + 1.0) * 0.5;
      highp float toon = max(floor(lighting * 4.0) / 4.0, 0.4);
      highp vec3 col = _surface.diffuse_color.rgb * (0.8 + toon * 0.2) * (sin(time*0.003)*0.05+0.95);
      highp float edge = pow(1.0 - abs(lighting - 0.5) * 2.0, 3.0);
      col += vec3(1.0) * edge * 0.5;
      _surface.diffuse_color = vec4(col, 1.0);
    `
  }
}
```

### Animated Rim Glow on a GLB model (`shaderOverrides`)

Two variants from the showcase — both use `_surface.view` (works reliably in this context):

```javascript
// Black base with pulsing animated red rim
ViroMaterials.createMaterials({
  blackRedRim: {
    lightingModel: "Phong",
    shaderModifiers: {
      surface: `
        uniform highp float time;
        highp float edge = abs(dot(_surface.normal, normalize(_surface.view)));
        edge = 1.0 - edge;
        edge = pow(edge, 3.0);
        highp float pulse = sin(time * 0.002) * 0.3 + 0.7;
        highp float animatedEdge = pow(edge, 3.0 - pulse * 1.5);
        _surface.diffuse_color = vec4(animatedEdge * pulse, 0.0, 0.0, 1.0);
      `,
    },
  },

  // Original texture preserved, red rim added on top
  normalRedRim: {
    lightingModel: "Constant",
    shaderModifiers: {
      surface: `
        uniform highp float time;
        highp vec3 baseColor = _surface.diffuse_color.rgb;
        highp float edge = abs(dot(_surface.normal, normalize(_surface.view)));
        edge = 1.0 - edge;
        highp float pulse = sin(time * 0.002) * 0.4 + 0.6;
        highp float wave = sin(time * 0.001 + _surface.normal.y * 5.0) * 0.3 + 0.7;
        highp float animatedEdge = pow(edge, 3.0 - pulse * 1.0);
        _surface.diffuse_color.rgb = baseColor + vec3(animatedEdge * pulse * wave * 2.5, 0.0, 0.0);
      `,
    },
  },
});

// Animate the time uniform at ~60 fps
const interval = setInterval(() => {
  const time = Date.now() % 1_000_000;
  ViroMaterials.updateShaderUniform("blackRedRim",  "time", "float", time);
  ViroMaterials.updateShaderUniform("normalRedRim", "time", "float", time);
}, 16);

// Apply to a GLB model — shaderOverrides merges shaders without replacing textures
// @ts-ignore (shaderOverrides not yet in Viro3DObject prop types but accepted at runtime)
<Viro3DObject source={require('./model.glb')} type="GLB" shaderOverrides={["blackRedRim"]} />
```

---

## Shader Creation Guidelines

1. **Start with `surface` + `lightingModel: "Constant"`** — direct color output, predictable
2. **Use `_surface.position` for screen UV** — no geometry modifier needed, no binary dependency
3. **Declare all uniforms at the top** — undeclared uniform = immediate crash
4. **Precision qualifiers on everything** — `highp` for positions/time/matrices, `mediump` for colors
5. **Avoid reserved names** — `t`, `n`, `b`, `v`, `frag_color`
6. **Use `shaderOverrides` for GLB/VRX models** — preserves original textures
7. **Be careful with `varyings`** — only use if you've confirmed binary support

### Debugging Shaders

```javascript
// Step 1: Verify compilation (pure red)
surface: `_surface.diffuse_color = vec4(1.0, 0.0, 0.0, 1.0);`

// Step 2: Visualize a value
surface: `
  highp float debugVal = /* your expression */;
  _surface.diffuse_color.rgb = vec3(debugVal);
`

// Step 3: Visualize normals
surface: `_surface.diffuse_color.rgb = _surface.normal * 0.5 + 0.5;`

// Step 4: Visualize world position
surface: `_surface.diffuse_color.rgb = fract(_surface.position);`

// Step 5: Visualize screen UV
surface: `
  uniform highp mat4 view_matrix;
  uniform highp mat4 projection_matrix;
  highp vec4 clip = projection_matrix * view_matrix * vec4(_surface.position, 1.0);
  highp vec2 uv   = clip.xy / clip.w * 0.5 + 0.5;
  _surface.diffuse_color.rgb = vec3(uv, 0.0);
`
```

### Performance

| Operation | Cost |
|-----------|------|
| Simple math, `sin`, `cos`, `normalize` | ✅ Fast |
| Single texture lookup | ✅ Fast |
| 2–3 texture lookups (depth + camera) | ⚠️ Moderate |
| Loops in fragment shaders | ❌ Expensive |
| `discard` | ❌ Use sparingly (breaks early-Z) |

---

## Troubleshooting

### Crash: `Use of undeclared identifier 'u_time'`
Uniform used without being declared. Declare at the top of the modifier.

### Crash: `Type (vec3) of redeclaration of 't' is incompatible`
Single-letter name conflicts with ReactViro internals. Rename to `animTime`, `wavePhase`, etc.

### Crash: App crashes silently after adding `varyings`
Binary doesn't have varying pragma support. Remove `varyings` and compute the needed value using `_surface.position` + matrices in the surface modifier instead.

### Crash: `'float' : declaration must include a precision qualifier`
```glsl
// ❌  uniform float time;
// ✅  uniform highp float time;
```

### Crash (Android): OES extension error
Never declare `samplerExternalOES` yourself for `camera_texture` — always use `sampler2D`. The engine handles the platform difference.

### Fragment colors not showing
Writing to `frag_color` instead of `_output_color` in a fragment modifier — it gets overwritten. Use `_output_color`.

### Camera texture distorted / wrong orientation
Not applying `camera_image_transform`. Always: `(camera_image_transform * vec4(screenUV, 0.0, 1.0)).xy`

### Uniform update lag on Android (multi-material toggle)
Fixed in current ViroCore: the material copy is deferred to inside the GL lambda, ensuring all preceding uniform-update lambdas have already run. If on an older binary, add a no-op update to all affected materials each frame as a workaround.

---

## Known Issues

### `_surface.view` (Under Investigation)

`_surface.view` is computed in the shader template but may not behave as expected. Use lighting-based edge detection instead:

```glsl
// ⚠️ May not work correctly
highp float rim = 1.0 - abs(dot(_surface.normal, _surface.view));

// ✅ Reliable workaround
highp float lighting = (dot(_surface.normal, normalize(vec3(0.5, 1.0, 0.5))) + 1.0) * 0.5;
highp float rim = pow(1.0 - abs(lighting - 0.5) * 2.0, 3.0);
```

### Android OES Extension on Older Devices

Older binaries always inject `GL_OES_EGL_image_external_essl3 : require` even on devices that only support the base `GL_OES_EGL_image_external`. Fixed in current ViroCore by checking `glGetString(GL_EXTENSIONS)` before choosing the directive.

---

## Implementation Status

### ✅ Fully Working

- Static shader modifiers: geometry, surface, lightingModel, fragment
- `requiresSceneDepth` — engine auto-binds depth texture; screen UV via `_surface.position`
- `requiresCameraTexture` — engine auto-binds camera texture + transform; OES handled on Android
- Custom sampler uniforms — `uniform sampler2D` in modifiers, set via `materialUniforms` and `updateShaderUniform`
- Animated uniforms — `updateShaderUniform()` (float, vec3, vec4, mat4, sampler2D)
- `shaderOverrides` — preserves model textures, recursive on GLB/VRX hierarchies
- Modifier priority — internal ordering system (transparent to React Native developers)
- Android uniform copy race fix — material copy deferred to GL thread

### Platform Compatibility

| Feature | iOS (Metal) | Android (OpenGL ES) |
|---------|-------------|---------------------|
| `surface` modifier | ✅ | ✅ |
| `geometry` modifier | ✅ | ✅ |
| `requiresSceneDepth` | ✅ LiDAR | ✅ ARCore depth |
| `requiresCameraTexture` | ✅ sampler2D | ✅ OES injected automatically |
| Custom sampler uniforms | ✅ | ✅ |
| `_surface.position` | ✅ | ✅ |
| `view_matrix` / `projection_matrix` in surface | ✅ | ✅ |
| `varyings` | ⚠️ binary-dependent | ⚠️ binary-dependent |
| GLSL ES 3.0 | ✅ | ✅ |

---

## Further Reading

- [GLSL ES 3.0 Specification](https://www.khronos.org/files/opengles_shading_language.pdf)
- [The Book of Shaders](https://thebookofshaders.com/)
- [Shader Toy](https://www.shadertoy.com/) — Fragment shader examples
