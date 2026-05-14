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

    // World tracking for device-anchor-based view matrix.
    private let arSession = ARKitSession()
    private let worldTracking = WorldTrackingProvider()

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
            if loopCount <= 3 || loopCount % 300 == 0 {
                NSLog("[Viro] render loop iteration \(loopCount)")
            }
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
            LayerRenderer.Clock().wait(until: timing.optimalInputTime)
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
        let deviceFromWorld: simd_float4x4
        if let anchor = worldTracking.queryDeviceAnchor(atTimestamp: CACurrentMediaTime()) {
            deviceFromWorld = anchor.originFromAnchorTransform.inverse
        } else {
            deviceFromWorld = matrix_identity_float4x4
        }

        // Drive prepareFrame once using the first drawable's left-eye data.
        let primary = drawables[0]
        if !primary.views.isEmpty {
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

            commandBuffer.addCompletedHandler { cb in
                if let error = cb.error {
                    NSLog("[Viro] commandBuffer GPU error: \(error)")
                }
            }

            let viewCount = drawable.views.count
            for i in 0..<viewCount {
                let view         = drawable.views[i]
                let colorTexture = drawable.colorTextures[i]
                let depthTexture = drawable.depthTextures[i]

                let renderPass = MTLRenderPassDescriptor()
                renderPass.colorAttachments[0].texture     = colorTexture
                renderPass.colorAttachments[0].loadAction  = .clear
                renderPass.colorAttachments[0].clearColor  = MTLClearColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0)
                renderPass.colorAttachments[0].storeAction = .store
                renderPass.depthAttachment.texture     = depthTexture
                renderPass.depthAttachment.loadAction  = .clear
                renderPass.depthAttachment.clearDepth  = 1.0
                renderPass.depthAttachment.storeAction = .dontCare

                guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPass) else {
                    continue
                }

                let eyeFromWorld = view.transform * deviceFromWorld
                bridge.renderEye(
                    withViewIndex: UInt(i),
                    encoder: encoder,
                    colorTexture: colorTexture,
                    depthTexture: depthTexture,
                    viewTransform: eyeFromWorld,
                    tangents: Self.tangentsFromDrawable(drawable, viewIndex: i))

                encoder.endEncoding()
            }

            drawable.encodePresent(commandBuffer: commandBuffer)
            commandBuffer.commit()
        }

        frame.endSubmission()
        bridge.endFrame()
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
