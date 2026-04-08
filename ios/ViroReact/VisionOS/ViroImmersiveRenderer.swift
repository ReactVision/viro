// ViroImmersiveRenderer.swift
// ViroReact — VisionOS
//
// Core Metal render loop for the Viro ImmersiveSpace.
// Uses CompositorServices to drive a per-frame stereo render loop.
//
// POC Week 1 status:
//   Clears both eye textures to Viro blue — confirms the CompositorServices
//   pipeline is wired up and the ImmersiveSpace is receiving frames.
//
// Week 2 plan:
//   Replace the clear-color stub with real VRORenderer output by:
//     1. Creating a VRODriverMetal with the drawable's MTLDevice
//     2. Creating a VRORenderer and wiring a VROSceneController
//     3. Per frame: extracting per-eye view matrices from drawable.views[i].transform
//        and projection from drawable.views[i].tangents, feeding them into
//        VRORenderer::renderEye(VROEyeType, ...) with the drawable textures
//        as the render targets.

#if os(visionOS)
import Foundation
import CompositorServices
import Metal

@available(visionOS 1.0, *)
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
    private var renderTask: Task<Void, Never>?

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
    }

    // MARK: - Lifecycle

    public func startRenderLoop() {
        renderTask = Task(priority: .high) {
            await self.runRenderLoop()
        }
    }

    public func stopRenderLoop() {
        renderTask?.cancel()
        renderTask = nil
    }

    // MARK: - Render loop

    private func runRenderLoop() async {
        // Block until the system is ready to start rendering.
        layerRenderer.waitUntilRunning()

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: ViroImmersiveRenderer.didBecomeActiveNotification,
                object: nil)
        }

        while !Task.isCancelled {
            switch layerRenderer.state {
            case .invalidated:
                // System tore down the layer — stop.
                break
            case .paused:
                // App backgrounded — wait for resume.
                layerRenderer.waitUntilRunning()
                continue
            default:
                break
            }

            if layerRenderer.state == .invalidated { break }

            renderFrame()
        }

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: ViroImmersiveRenderer.didBecomeInactiveNotification,
                object: nil)
        }
    }

    // MARK: - Per-frame render

    private func renderFrame() {
        guard let frame = layerRenderer.queryNextFrame() else { return }
        frame.startSubmission()

        // Wait for optimal input time so head-tracking data is fresh.
        let timing = frame.predictTiming()
        LayerRenderer.Clock.wait(until: timing.optimalInputTime)

        guard let commandBuffer = commandQueue.makeCommandBuffer() else {
            frame.endSubmission()
            return
        }

        guard let drawable = try? frame.queryDrawable() else {
            commandBuffer.commit()
            frame.endSubmission()
            return
        }

        // ── POC Week 1: render one pass per eye ──────────────────────────
        // TODO Week 2: feed drawable + per-eye transforms into VRORenderer.
        //
        // Per-eye data available at drawable.views[i]:
        //   .transform               — simd_float4x4 from world space
        //   .tangents                — (left, right, up, down) tangents for projection
        //   .textureMap              — .layered { layerIndex } or .viewport { ... }

        let viewCount = drawable.views.count  // typically 2 — left eye, right eye
        for i in 0..<viewCount {
            renderEyePassStub(
                commandBuffer: commandBuffer,
                drawable: drawable,
                viewIndex: i)
        }

        drawable.encodePresent(commandBuffer: commandBuffer)
        commandBuffer.commit()
        frame.endSubmission()
    }

    /// Stub render pass — clears to Viro blue per eye.
    /// Replace with VRORenderer output in Week 2.
    private func renderEyePassStub(
        commandBuffer: MTLCommandBuffer,
        drawable: LayerRenderer.Drawable,
        viewIndex: Int
    ) {
        let renderPass = MTLRenderPassDescriptor()

        // Color — Viro brand blue (#0061B0), alpha 0 so passthrough is visible
        renderPass.colorAttachments[0].texture    = drawable.colorTextures[viewIndex]
        renderPass.colorAttachments[0].loadAction  = .clear
        renderPass.colorAttachments[0].clearColor  = MTLClearColor(red: 0.0, green: 0.38, blue: 0.69, alpha: 0.0)
        renderPass.colorAttachments[0].storeAction = .store

        // Depth
        renderPass.depthAttachment.texture    = drawable.depthTextures[viewIndex]
        renderPass.depthAttachment.loadAction  = .clear
        renderPass.depthAttachment.clearDepth  = 0.0
        renderPass.depthAttachment.storeAction = .dontCare

        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPass) else {
            return
        }
        encoder.endEncoding()
    }
}
#endif  // os(visionOS)
