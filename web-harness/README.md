# Web harness

A dev test tool: `index.html` / `main.tsx` render the real Viro web bridge
(`components/*.web.tsx`) on the WASM renderer, one mode at a time. The mode
button (top right) cycles through them. `render.html` / `render.tsx` is the
headless entry reactviro-mcp-server drives; it is not covered here.

Every mode shares two overlays, sized to read on a phone:

- **status** (top left): live values such as tap counters, tracking state,
  camera feed size and mount counters.
- **log** (bottom): the last 20 lines, errors in red. `log ▼` collapses it and
  `clear` empties it. Everything in it also goes to the console.

## URL params

| Param | Mode | What it does |
| --- | --- | --- |
| `?mode=3d\|ar\|studio\|input\|camera` | all | Initial mode. The URL follows the mode button, so a reload stays put. |
| `?glb=<url>` | 3D, Studio | 3D: loads this GLB instead of the helmet. Studio (fixture only): adds it as an extra 3D-MODEL asset. Load start, load time and size in MB are logged. The URL must allow CORS. |
| `?glbScale=<n>` | 3D | Uniform scale for the `?glb` model (default 1.6). |
| `?scene=<uuid>&key=<apiKey>` | Studio | Fetches the real scene instead of the fixture (see below). |
| `?base=<url>` | Studio | Platform origin for `?scene`. Default `https://platform.reactvision.xyz`. |
| `?ticker=1` | Studio | Starts the re-render ticker on load. |

### Studio scene fetch

This works the same way as native `VRTStudioModule.rvGetScene`:
`GET {base}/functions/v1/scenes/{uuid}` with header `x-api-key: <key>`. The
response body is the `StudioSceneResponse` JSON. The same fetcher handles
NAVIGATION to other scenes. API_REQUEST functions go to
`POST {base}/functions/v1/scene-api-request` with `{function_id, variables}`,
the same call native `rvStudioApiRequest` makes. Without `?key` they return a
canned success.

The log shows the HTTP status, the time taken and the body size. On an error
it also shows the start of the error body. A fetch that fails without any
HTTP status is reported as a probable CORS or network failure. The
platform's preflight currently allows any origin and the `x-api-key` header,
so a CORS failure there is unexpected.

## Checklist coverage

| Item | Where | How to check it |
| --- | --- | --- |
| W1 big GLB | `?mode=3d&glb=<url>` | The log shows `loaded in N ms (X MB)`, or the error and when it happened. |
| W2 taps | `?mode=3d`, `?mode=ar` | Tap the box up and to the right of centre. The `taps` counter goes up. A tap at the mirrored spot must not count. |
| W3 dropout hold | `?mode=ar` | The `tracking` status shows the current state. Each change is logged as `A → B after Ns`, which gives how long each state held. |
| W4 smoothing | `?mode=ar` | Visual: the world-fixed cube 1 m ahead should hold still without jitter. Tracking changes are logged as in W3. |
| W5 feed 1280x960 | `?mode=ar` | After Start, the `feed` status shows `videoWidth x videoHeight` of the session's camera `<video>`. The log also shows the track settings. |
| W6 motion denied | `?mode=ar` | Deny motion access, or get no motion events. The `motion` status and a red line show `denied` or `no-events`. |
| W7 transparent PNG borders | `?mode=studio` | The orange disc on a green square is in front of the helmet. Its transparent border must show the helmet, with no black or white frame. |
| W8 Studio mounts once | `?mode=studio` | Turn `ticker` on (top left). `parent renders` goes up every 500 ms, while `scene mounts` and `canvas mounts` must stay at 1. |
| onAssetError | `?mode=studio` | The fixture's "Missing model (404)" logs `onAssetError ... (404)` in red. |
| onRendererAbort | `?mode=studio&glb=<huge.glb>` | A WASM abort (usually out of memory) logs `onRendererAbort` and replaces the scene with an error message. |

In Studio mode, `onMotionUnavailable` is passed to StudioSceneNavigator too.
It only reaches the log once the navigator forwards it to the AR navigator.

## Running on a phone

AR mode needs HTTPS for camera and motion access. An ngrok tunnel gives you
that without setting up local certificates:

```bash
npm run harness:assets      # copy viro-web + tinyvio-slam WASM into wasm/ and public/
npx vite --port 5199        # from the viro repo root
ngrok http 5199             # open https://<id>.ngrok-free.app/?mode=ar on the phone
```

`vite.config.ts` already allows `.ngrok-free.app` hosts. `models/` (the
DamagedHelmet GLB and the dragon VRX) is gitignored, and `harness:assets` does
not copy it, so it must already be in place.
