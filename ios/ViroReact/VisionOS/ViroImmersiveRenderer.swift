// ViroImmersiveRenderer.swift
// ViroReact — VisionOS
//
// Core Metal render loop for the Viro ImmersiveSpace.
// Uses CompositorServices to drive a per-frame stereo render loop.

#if os(visionOS)
import Foundation
import CompositorServices
import Metal
import ARKit

public final class ViroImmersiveRenderer: @unchecked Sendable {

    // MARK: - Public notifications

    /// Posted on the main queue when the render loop is running.
    public static let didBecomeActiveNotification =
        Notification.Name("ViroImmersiveRendererDidBecomeActive")

    /// Posted on the main queue when the render loop ends (invalidated or cancelled).
    public static let didBecomeInactiveNotification =
        Notification.Name("ViroImmersiveRendererDidBecomeInactive")

    // MARK: - Private state

    private let layerRenderer: LayerRenderer
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let bridge: VRORendererBridge
    private var renderTask: Task<Void, Never>?
    private var _diagFrames = 0
    // 8 bytes = 1 rgba16Float pixel (4 × 2-byte float16). Shared = CPU-readable after GPU completes.
    private let readbackBuffer: MTLBuffer?

    // World tracking for device-anchor-based view matrix.
    private let arSession = ARKitSession()
    private let worldTracking = WorldTrackingProvider()
    private var _frameCount = 0

    // DIAG: set true to skip C++ rendering and show only the green clear.
    // If the user sees green → C++ pipeline is the problem.
    // If still black  → Metal/CompositorServices submission is the problem.
    private static let diagBypassCPP = true

    // DIAG: set true to skip ALL bridge calls (prepareFrame + endFrame).
    // If green appears with this true but not with diagBypassCPP-only →
    // prepareFrame or endFrame is overwriting/clearing our drawable texture.
    private static let diagBypassBridge = true

    // MARK: - Init

    public init(layerRenderer: LayerRenderer) {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("[Viro] VisionOS: No MTLDevice available")
        }
        guard let queue = device.makeCommandQueue() else {
            fatalError("[Viro] VisionOS: Failed to create MTLCommandQueue")
        }
        self.layerRenderer = layerRenderer
        self.device = device
        self.commandQueue = queue
        self.bridge = VRORendererBridge(device: device)
        self.readbackBuffer = device.makeBuffer(length: 8, options: .storageModeShared)
    }

    // MARK: - Lifecycle

    public func startRenderLoop() {
        renderTask = Task(priority: .high) {
            if WorldTrackingProvider.isSupported {
                try? await self.arSession.run([self.worldTracking])
            }
            await self.runRenderLoop()
        }
    }

    public func stopRenderLoop() {
        renderTask?.cancel()
        renderTask = nil
    }

    // MARK: - Render loop

    private func runRenderLoop() async {
        layerRenderer.waitUntilRunning()

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: ViroImmersiveRenderer.didBecomeActiveNotification,
                object: nil)
        }

        var loopCount = 0
        while !Task.isCancelled {
            let state = layerRenderer.state
            switch state {
            case .invalidated:
                NSLog("[Viro] render loop exiting: state=invalidated after \(loopCount) iterations")
                break
            case .paused:
                layerRenderer.waitUntilRunning()
                continue
            default:
                break
            }

            if layerRenderer.state == .invalidated { break }

            renderFrame()
            loopCount += 1
        }
        NSLog("[Viro] render loop ended after \(loopCount) iterations, cancelled=\(Task.isCancelled)")

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: ViroImmersiveRenderer.didBecomeInactiveNotification,
                object: nil)
        }
    }

    // MARK: - Per-frame render

    private func renderFrame() {
        guard let frame = layerRenderer.queryNextFrame() else {
            NSLog("[Viro] queryNextFrame returned nil — state: \(layerRenderer.state.rawValue)")
            return
        }
        frame.startSubmission()

        if let timing = frame.predictTiming() {
            let t0 = CACurrentMediaTime()
            LayerRenderer.Clock().wait(until: timing.optimalInputTime)
            if _frameCount < 3 {
                NSLog("[Viro] timing wait=%.2fms", (CACurrentMediaTime() - t0) * 1000)
            }
        }

        // queryDrawable() is deprecated + API_UNAVAILABLE(macosx) — crashes in simulator.
        // queryDrawables() returns an array. Empty = frame cancelled; invalid to access further.
        let drawables = frame.queryDrawables()
        guard !drawables.isEmpty else {
            NSLog("[Viro] queryDrawables empty — skipping frame")
            // Do NOT call frame.endSubmission() — frame is invalid when array is empty.
            return
        }

        // Resolve device anchor → world-to-device transform.
        // view.transform is eye-from-device (fixed IPD offset).
        // To get eye-from-world (view matrix) we compose:
        //   eyeFromWorld = view.transform × inverse(deviceAnchor.originFromAnchorTransform)
        //
        // The anchor MUST also be set on each drawable via setDeviceAnchor() before
        // encodePresent() — CompositorServices silently discards every frame that lacks it.
        let deviceAnchor = worldTracking.queryDeviceAnchor(atTimestamp: CACurrentMediaTime())

        _frameCount += 1
        if _frameCount == 1 || _frameCount % 90 == 0 {
            let anchorStr = deviceAnchor == nil ? "NIL" : "ok"
            let stateStr  = drawables.first.map { String(describing: $0.state) } ?? "?"
            NSLog("[Viro] HEARTBEAT frame=%d anchor=%@ drawableState=%@ bypassCPP=%@ drawableCount=%d",
                  _frameCount, anchorStr, stateStr, Self.diagBypassCPP ? "YES" : "NO", drawables.count)
        }
        if _frameCount <= 3 {
            for (di, d) in drawables.enumerated() {
                NSLog("[Viro] drawable[%d] target=%@ state=%@",
                      di, String(describing: d.target), String(describing: d.state))
            }
        }
        if _frameCount <= 5, let a = deviceAnchor {
            let p = a.originFromAnchorTransform.columns.3
            NSLog("[Viro] anchor frame=%d tracked=%@ pos=(%.3f,%.3f,%.3f)",
                  _frameCount, a.isTracked ? "YES" : "NO", p.x, p.y, p.z)
        }
        let deviceFromWorld: simd_float4x4 = deviceAnchor.map {
            $0.originFromAnchorTransform.inverse
        } ?? matrix_identity_float4x4

        // Drive prepareFrame once using the first drawable's left-eye data.
        let primary = drawables[0]
        if !Self.diagBypassBridge && !primary.views.isEmpty {
            let eyeFromWorld0 = primary.views[0].transform * deviceFromWorld
            bridge.prepareFrame(
                withViewIndex: 0,
                colorTexture: primary.colorTextures[0],
                viewTransform: eyeFromWorld0,
                tangents: Self.tangentsFromDrawable(primary, viewIndex: 0))
        }

        // Each drawable (built-in display, capture target, etc.) needs its own
        // command buffer and an encodePresent call — cp_frame_end_submission asserts
        // that every drawable returned by queryDrawables() was presented.
        for drawable in drawables {
            guard drawable.state == .rendering else { continue }
            guard let commandBuffer = commandQueue.makeCommandBuffer() else { continue }

            let capturedFrame = _frameCount
            let doReadback = capturedFrame == 1
            let rb = readbackBuffer
            commandBuffer.addCompletedHandler { cb in
                if capturedFrame <= 3 || capturedFrame % 90 == 0 {
                    NSLog("[Viro] cmdBuf status=%d frame=%d", cb.status.rawValue, capturedFrame)
                }
                if let error = cb.error {
                    NSLog("[Viro] commandBuffer GPU error: \(error)")
                }
                if doReadback, let rb {
                    // rgba16Float: 4 × UInt16. float16 1.0 = 0x3C00, 0.0 = 0x0000.
                    // Green clear → R=0000 G=3C00 B=0000 A=3C00
                    // Black       → R=0000 G=0000 B=0000 A=????
                    let p = rb.contents().bindMemory(to: UInt16.self, capacity: 4)
                    NSLog("[Viro] READBACK px(0,0): R=%04X G=%04X B=%04X A=%04X (green=0000,3C00,0000,3C00)",
                          p[0], p[1], p[2], p[3])
                }
            }

            let viewCount = drawable.views.count
            for i in 0..<viewCount {
                let view         = drawable.views[i]
                // Use textureMap.textureIndex (not the view index) to support both
                // .layered layout (1 shared MTLTextureType2DArray, index=0 for all views)
                // and .dedicated layout (separate textures, textureIndex matches view index).
                // Indexing with i directly crashes on device when .layered is active because
                // colorTextures has only 1 element.
                let colorTexture = drawable.colorTextures[view.textureMap.textureIndex]
                let depthTexture = drawable.depthTextures[view.textureMap.textureIndex]
                // .layered: texture is a 2DArray — render each eye into its own slice.
                // .dedicated: each texture has a single layer — slice is always 0.
                let colorSlice = colorTexture.textureType == .type2DArray ? i : 0
                let depthSlice = depthTexture.textureType == .type2DArray ? i : 0

                // One-shot diagnostic: log texture properties on the first eye of the first frame.
                if _diagFrames == 0 && i == 0 {
                    NSLog("[Viro] DIAG color: fmt=%d type=%d size=%dx%d arrayLen=%d slice=%d",
                          colorTexture.pixelFormat.rawValue, colorTexture.textureType.rawValue,
                          colorTexture.width, colorTexture.height, colorTexture.arrayLength, colorSlice)
                    NSLog("[Viro] DIAG depth:  fmt=%d type=%d size=%dx%d arrayLen=%d slice=%d",
                          depthTexture.pixelFormat.rawValue, depthTexture.textureType.rawValue,
                          depthTexture.width, depthTexture.height, depthTexture.arrayLength, depthSlice)
                    NSLog("[Viro] DIAG views=%d colorTextures=%d depthTextures=%d",
                          viewCount, drawable.colorTextures.count, drawable.depthTextures.count)
                    for vi in 0..<viewCount {
                        let vp = drawable.views[vi].textureMap.viewport
                        NSLog("[Viro] DIAG view[%d] texIdx=%d viewport=(%.0f,%.0f %.0fx%.0f)",
                              vi, drawable.views[vi].textureMap.textureIndex,
                              vp.originX, vp.originY, vp.width, vp.height)
                    }
                    _diagFrames += 1
                }

                let renderPass = MTLRenderPassDescriptor()
                renderPass.colorAttachments[0].texture     = colorTexture
                renderPass.colorAttachments[0].slice       = colorSlice
                renderPass.colorAttachments[0].loadAction  = .clear
                renderPass.colorAttachments[0].clearColor  = MTLClearColor(red: 0.0, green: 1.0, blue: 0.0, alpha: 1.0)   // DIAG: green clear
                renderPass.colorAttachments[0].storeAction = .store
                renderPass.depthAttachment.texture     = depthTexture
                renderPass.depthAttachment.slice       = depthSlice
                renderPass.depthAttachment.loadAction  = .clear
                renderPass.depthAttachment.clearDepth  = 1.0
                renderPass.depthAttachment.storeAction = .dontCare

                guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPass) else {
                    NSLog("[Viro] ERROR: makeRenderCommandEncoder nil view=%d frame=%d fmt=%d type=%d slice=%d",
                          i, _frameCount,
                          colorTexture.pixelFormat.rawValue,
                          colorTexture.textureType.rawValue,
                          colorSlice)
                    continue
                }

                let eyeFromWorld = view.transform * deviceFromWorld
                if !Self.diagBypassCPP {
                    bridge.renderEye(
                        withViewIndex: UInt(i),
                        encoder: encoder,
                        colorTexture: colorTexture,
                        depthTexture: depthTexture,
                        viewTransform: eyeFromWorld,
                        tangents: Self.tangentsFromDrawable(drawable, viewIndex: i))
                }

                encoder.endEncoding()
            }

            // Blit 1 pixel from left-eye texture → readbackBuffer so we can verify
            // the clear color actually landed in the texture (only on frame 1).
            if doReadback, let rb,
               let blit = commandBuffer.makeBlitCommandEncoder() {
                let leftTex = drawable.colorTextures[0]
                blit.copy(from: leftTex,
                          sourceSlice: 0, sourceLevel: 0,
                          sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
                          sourceSize: MTLSize(width: 1, height: 1, depth: 1),
                          to: rb, destinationOffset: 0,
                          destinationBytesPerRow: 8, destinationBytesPerImage: 8)
                blit.endEncoding()
            }

            // Required: set device anchor before encodePresent so CompositorServices
            // can correctly place the rendered content in world space.
            // visionOS 26+: property assignment (replaces setDeviceAnchor method from visionOS 2.x).
            drawable.deviceAnchor = deviceAnchor
            if _frameCount <= 3 || _frameCount % 90 == 0 {
                NSLog("[Viro] encodePresent frame=%d anchor=%@", _frameCount, deviceAnchor == nil ? "NIL" : "ok")
            }
            drawable.encodePresent(commandBuffer: commandBuffer)
            commandBuffer.commit()
        }

        frame.endSubmission()
        if !Self.diagBypassBridge { bridge.endFrame() }
    }

    // MARK: - Tangent extraction

    /// Derives signed frustum tangents from the drawable's projection matrix.
    ///
    /// cp_view_get_tangents is deprecated (visionOS 2.0) and unavailable on macOS
    /// (simulator). cp_drawable_compute_projection is available on visionOS 2.0+
    /// and macOS 26.0+, so it works in both simulator and on-device.
    ///
    /// The x/y components of the projection matrix are depth-convention-independent;
    /// we extract (left, right, up, down) signed tangents that VRORendererBridge
    /// feeds into its asymmetric-frustum projection helper.
    private static func tangentsFromDrawable(
        _ drawable: LayerRenderer.Drawable,
        viewIndex: Int
    ) -> SIMD4<Float> {
        let proj = drawable.computeProjection(viewIndex: viewIndex)
        // col0.x = 2/(r−l), col2.x = (r+l)/(r−l)  →  l=(c2x−1)/c0x, r=(c2x+1)/c0x
        // col1.y = 2/(u−d), col2.y = (u+d)/(u−d)  →  d=(c2y−1)/c1y, u=(c2y+1)/c1y
        let c0x = proj.columns.0.x
        let c1y = proj.columns.1.y
        let c2x = proj.columns.2.x
        let c2y = proj.columns.2.y
        return SIMD4<Float>(
            (c2x - 1.0) / c0x,   // left  (negative)
            (c2x + 1.0) / c0x,   // right (positive)
            (c2y + 1.0) / c1y,   // up    (positive)
            (c2y - 1.0) / c1y    // down  (negative)
        )
    }
}
#endif  // os(visionOS)
