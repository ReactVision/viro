# Viro en React web — guía 3D (sin AR)

Paso a paso para renderizar escenas 3D de Viro en una app **React web** normal
(Vite), **sin AR**. Obtienes primitivos, modelos, materiales, luces, animaciones,
texto, imágenes, video y eventos — todo corriendo en WebGL2 vía WebAssembly. Sin
cámara, sin slam-wasm, sin requisito de HTTPS, sin prompts de permisos.

> Para AR, ver [Usage → AR](./USAGE.md#ar). Para otros bundlers (webpack,
> Metro/Expo) y despliegue, ver [Integration](./INTEGRATION.md).
> (English version: [REACT_WEB_GUIDE.md](./REACT_WEB_GUIDE.md).)

---

## 1. Crear una app React (Vite)

```sh
npm create vite@latest my-viro-app -- --template react-ts
cd my-viro-app
```

## 2. Instalar

```sh
npm install @reactvision/react-viro @reactvision/viro-web-renderer react-native-web
```

- `@reactvision/react-viro` — los componentes (resuelven a `.web.tsx` en web).
- `@reactvision/viro-web-renderer` — el renderer WASM/WebGL2.
- `react-native-web` — el shim RN → DOM sobre el que se apoyan los componentes.

## 3. Configurar Vite

El bundler debe resolver `.web.tsx` primero, aliasar `react-native` →
`react-native-web`, y tratar los sidecars WASM como assets.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: { "react-native": "react-native-web" },
  },
  optimizeDeps: {
    // No pre-empaquetar el renderer — esbuild reescribe import.meta.url y rompe
    // la resolución de los sidecars .wasm/.data por parte del loader.
    exclude: ["@reactvision/viro-web-renderer"],
  },
  assetsInclude: ["**/*.data", "**/*.wasm"],
});
```

No hacen falta headers COOP/COEP — el build es single-thread.

## 4. Apuntar el renderer a sus assets WASM

El renderer trae tres archivos (`viro-web.js`, `viro-web.wasm`, `viro-web.data`).
Importa sus URLs con el `?url` de Vite y pásalos al navigator vía
`webRendererOptions`:

```ts
// webRenderer.ts
import glueUrl from "@reactvision/viro-web-renderer/wasm/viro-web.js?url";
import wasmUrl from "@reactvision/viro-web-renderer/wasm/viro-web.wasm?url";
import dataUrl from "@reactvision/viro-web-renderer/wasm/viro-web.data?url";

export const webRendererOptions = {
  importGlue: () => import(/* @vite-ignore */ glueUrl),
  locateFile: (path: string) =>
    path.endsWith(".wasm") ? wasmUrl : path.endsWith(".data") ? dataUrl : path,
};
```

## 5. Escribir una escena

```tsx
// App.tsx
import {
  Viro3DSceneNavigator, ViroScene, ViroNode,
  ViroBox, ViroSphere, ViroText,
  ViroAmbientLight, ViroDirectionalLight,
  ViroMaterials, ViroAnimations,
} from "@reactvision/react-viro";
import { webRendererOptions } from "./webRenderer";

ViroMaterials.createMaterials({
  blue: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  red: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
});

ViroAnimations.registerAnimations({
  spin: { duration: 2000, easing: "Linear", properties: { rotateY: 360 } },
});

function MyScene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} castsShadow />

      <ViroText
        position={[0, 1.5, -3]}
        width={4}
        height={1}
        text="Hola Viro Web"
        style={{ fontSize: 36, color: "#ffffff", textAlign: "Center" }}
      />

      <ViroNode position={[0, 0, -3]}>
        <ViroBox
          materials={["blue"]}
          animation={{ name: "spin", run: true, loop: true }}
          onClick={() => console.log("clic en la caja")}
        />
        <ViroSphere position={[1.5, 0, 0]} radius={0.4} materials={["red"]} />
      </ViroNode>
    </ViroScene>
  );
}

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Viro3DSceneNavigator
        initialScene={{ scene: MyScene }}
        webRendererOptions={webRendererOptions}
      />
    </div>
  );
}
```

El navigator es dueño de un `<canvas>` a tamaño completo; dale a su contenedor una
altura real (aquí `100vh`) o el canvas colapsa.

## 6. Ejecutar

```sh
npm run dev
```

Abre la URL impresa. Deberías ver el texto, una caja azul girando (clickeable) y
una esfera roja.

---

## Qué puedes usar (sin AR)

| Necesitas | Componentes |
|---|---|
| Agrupar / transforms | `ViroNode` |
| Primitivos | `ViroBox`, `ViroSphere`, `ViroQuad`, `ViroSurface`, `ViroPolyline`, `ViroPolygon`, `ViroGeometry` |
| Texto e imágenes | `ViroText`, `ViroImage`, `ViroButton`, `ViroSpinner` |
| Modelos 3D | `Viro3DObject` (GLB / VRX + skinning + animaciones de modelo) |
| Fondos | `ViroSkyBox`, `Viro360Image`, `Viro360Video` |
| Video y audio | `ViroVideo`, `ViroMaterialVideo`, `ViroSound`, `ViroSpatialSound` |
| Luces | `ViroAmbientLight`, `ViroDirectionalLight`, `ViroOmniLight`, `ViroSpotLight` |
| Iluminación basada en imagen | `ViroLightingEnvironment` (`.hdr`) |
| Cámara | `ViroCamera`, `ViroOrbitCamera` |
| Materiales / animación | `ViroMaterials`, `ViroAnimations` |
| Efectos / contenedores | `ViroParticleEmitter`, `ViroPortalScene` + `ViroPortal`, `ViroFlexView` |
| Utilidad | `ViroGameLoop` |
| Eventos | `onClick`, `onClickState`, `onHover` |

Referencia completa de props y ejemplos: [Usage](./USAGE.md).

### Cargar un modelo

```tsx
import helmet from "./DamagedHelmet.glb?url";

<Viro3DObject source={{ uri: helmet }} type="GLB" scale={[1.5, 1.5, 1.5]}
  onLoadEnd={() => console.log("cargado")} />
```

### Material texturizado + imagen

```tsx
ViroMaterials.createMaterials({
  crate: { lightingModel: "Lambert", diffuseTexture: require("./crate.png") },
});

<ViroImage source={{ uri: "/photo.jpg" }} width={1.5} height={1.5} />
```

---

## Gotchas

- **Canvas en blanco / 404 en `viro-web.wasm`/`.data`** — `webRendererOptions` no
  está resolviendo las URLs de los assets. Revisa la pestaña de red; asegúrate de
  que `optimizeDeps.exclude` incluya el renderer y de usar `importGlue`.
- **Se renderiza un componente nativo en vez del web** — `resolve.extensions` debe
  listar `.web.tsx` antes que `.tsx`.
- **Escena oscura** — el build web no agrega luces por defecto; añade una ambient
  o directional.
- **El canvas es una franja baja** — el contenedor del navigator necesita una
  altura explícita (`100vh` / px fijos); `height: 100%` colapsa sin ella.
- **El video/audio no autoreproduce** — política del navegador: el video en
  `muted` autoreproduce; audio y video sin mute requieren un gesto del usuario
  (arranca en un clic).

---

## Fuera de scope aquí

AR (`ViroARSceneNavigator`/`ViroARScene`/`ViroARPlane`), el layout flexbox
automático de `ViroFlexView`, image/object anchors, cadenas de animación, y
navegación multi-escena push/pop. Ver [Usage](./USAGE.md) para el estado de cada
uno.
