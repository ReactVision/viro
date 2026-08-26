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
// When built as part of the ViroReact pod, VRORendererBridge arrives as a module.
// The standalone ViroKitVisionOSTest app compiles this file directly and exposes the
// bridge through its bridging header instead, so the module is not available there.
#if canImport(ViroReact)
import ViroReact
#endif

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

    // World tracking for device-anchor-based view matrix.
    private let arSession = ARKitSession()
    private let worldTracking = WorldTrackingProvider()

    // Hand tracking is the only input a fully immersive app receives: gaze-and-pinch is
    // delivered as a SwiftUI SpatialEventGesture, which needs a view, and CompositorServices
    // hands out a Metal layer with no input API at all. So the pointing ray comes from the
    // index finger and the click from a pinch.
    private let handTracking = HandTrackingProvider()

    // Pinch is latched with hysteresis. A single threshold chatters around the boundary and
    // turns one deliberate pinch into a burst of clicks; closing at 2 cm and only releasing
    // at 3.2 cm costs nothing and makes the gesture read as one event.
    private static let pinchCloseDistance: Float = 0.020
    private static let pinchOpenDistance:  Float = 0.032
    private var leftPinching  = false
    private var rightPinching = false

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

        // Frame timing is opt-in through the VIRO_FRAME_TIMING environment variable rather
        // than a compile-time flag, so a device build can be measured without rebuilding.
        // Reports land in the log every 300 frames.
        if ProcessInfo.processInfo.environment["VIRO_FRAME_TIMING"] != nil {
            bridge.setFrameTimingEnabled(true)
        }
    }

    // MARK: - Lifecycle

    public func startRenderLoop() {
        renderTask = Task(priority: .high) {
            // Both providers go into a single run() — a second ARKitSession would be
            // refused, and running them together is what keeps their timestamps comparable.
            var providers: [any DataProvider] = []
            if WorldTrackingProvider.isSupported { providers.append(self.worldTracking) }
            if HandTrackingProvider.isSupported  { providers.append(self.handTracking) }
            else { NSLog("[Viro] hand tracking unsupported on this device — input will be inert") }

            if !providers.isEmpty {
                do {
                    try await self.arSession.run(providers)
                } catch {
                    NSLog("[Viro] ARKitSession.run() FAILED: %@", error.localizedDescription)
                }
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
        guard let frame = layerRenderer.queryNextFrame() else { return }

        // CompositorServices frames have two phases and they are not optional. The update phase
        // comes first and is where app state changes belong; only then is predictTiming valid,
        // and the submission phase must not open until the wait for optimalInputTime is over.
        //
        // Starting submission first — which this did — is a contract violation, and
        // CompositorServices reports it by aborting the process from inside
        // cp_drawable_encode_present as __BUG_IN_CLIENT__, naming neither the phase nor the
        // cause. Two seconds of a black immersive space, then SIGABRT.
        frame.startUpdate()
        frame.endUpdate()

        if let timing = frame.predictTiming() {
            LayerRenderer.Clock().wait(until: timing.optimalInputTime)
        }

        frame.startSubmission()

        // queryDrawable() is deprecated + API_UNAVAILABLE(macosx) — crashes in simulator.
        // queryDrawables() returns an array. Empty = frame cancelled; invalid to access further.
        let drawables = frame.queryDrawables()
        guard !drawables.isEmpty else {
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
        let deviceFromWorld: simd_float4x4 = deviceAnchor.map {
            $0.originFromAnchorTransform.inverse
        } ?? matrix_identity_float4x4

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

        // Hands are sampled once per frame, before any eye is rendered, so both eyes see the
        // same input state. Doing it per drawable would let the two eyes disagree about where
        // the pointer is, which reads as jitter.
        updateHandInput()

        // Each drawable (built-in display, capture target, etc.) needs its own
        // command buffer and an encodePresent call — cp_frame_end_submission asserts
        // that every drawable returned by queryDrawables() was presented.
        for drawable in drawables {
            guard drawable.state == .rendering else { continue }
            guard let commandBuffer = commandQueue.makeCommandBuffer() else { continue }

            // Every render command encoder — the display pass included — is opened
            // by the renderer from this buffer, so it must be handed over before any
            // eye is rendered.
            bridge.setFrameCommandBuffer(commandBuffer)

            commandBuffer.addCompletedHandler { cb in
                if let error = cb.error {
                    NSLog("[Viro] commandBuffer GPU error: \(error)")
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

                let renderPass = MTLRenderPassDescriptor()
                renderPass.colorAttachments[0].texture     = colorTexture
                renderPass.colorAttachments[0].slice       = colorSlice
                renderPass.colorAttachments[0].loadAction  = .clear
                renderPass.colorAttachments[0].clearColor  = MTLClearColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0)
                renderPass.colorAttachments[0].storeAction = .store
                renderPass.depthAttachment.texture     = depthTexture
                renderPass.depthAttachment.slice       = depthSlice
                renderPass.depthAttachment.loadAction  = .clear
                renderPass.depthAttachment.clearDepth  = 1.0
                // CompositorServices requires stored depth for late-stage reprojection.
                // .dontCare silently causes the compositor to discard the frame → black screen.
                renderPass.depthAttachment.storeAction = .store

                // The encoder is deliberately NOT created here. The renderer opens it
                // when the base render pass binds its output target, so that an
                // offscreen pass (bloom, shadows, tone mapping) can interleave —
                // Metal permits one render command encoder per command buffer at a
                // time, so a detour has to end the display encoder and reopen it.
                let eyeFromWorld = view.transform * deviceFromWorld
                bridge.renderEye(
                    withViewIndex: UInt(i),
                    renderPassDescriptor: renderPass,
                    colorTexture: colorTexture,
                    depthTexture: depthTexture,
                    viewTransform: eyeFromWorld,
                    tangents: Self.tangentsFromDrawable(drawable, viewIndex: i))
            }

            // A pass that returns without closing its encoder would abort the process inside
            // encodePresent below, as __BUG_IN_CLIENT__ with no message. Close it here and say
            // so, so the failure is a log line naming the frame instead of a crash report.
            if bridge.endAnyOpenEncoder() {
                NSLog("[Viro] a render pass left its command encoder open; closed it before present")
            }

            // Required: set device anchor before encodePresent so CompositorServices
            // can correctly place the rendered content in world space.
            // visionOS 26+: property assignment (replaces setDeviceAnchor method from visionOS 2.x).
            drawable.deviceAnchor = deviceAnchor
            drawable.encodePresent(commandBuffer: commandBuffer)
            commandBuffer.commit()
            bridge.setFrameCommandBuffer(nil)
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
    // MARK: - Hand input

    /// Samples both hands and hands the bridge a ray plus a pinch state for each.
    ///
    /// The ray starts at the index knuckle and points through the fingertip: taking the
    /// fingertip alone gives a position but no direction, and the wrist is too far back to
    /// aim with. A hand the tracker has lost is reported as invalid rather than left at its
    /// last pose — a stale ray that keeps hovering things is worse than no ray.
    private func updateHandInput() {
        let anchors = handTracking.latestAnchors

        func sample(_ anchor: HandAnchor?) -> (valid: Bool, origin: simd_float3,
                                               forward: simd_float3, pinching: Bool) {
            guard let anchor, anchor.isTracked,
                  let skeleton = anchor.handSkeleton else {
                return (false, .zero, .zero, false)
            }

            let originFromAnchor = anchor.originFromAnchorTransform
            func jointPosition(_ name: HandSkeleton.JointName) -> simd_float3? {
                let joint = skeleton.joint(name)
                guard joint.isTracked else { return nil }
                let m = originFromAnchor * joint.anchorFromJointTransform
                return simd_float3(m.columns.3.x, m.columns.3.y, m.columns.3.z)
            }

            guard let tip  = jointPosition(.indexFingerTip),
                  let base = jointPosition(.indexFingerKnuckle) else {
                return (false, .zero, .zero, false)
            }

            let direction = tip - base
            let length = simd_length(direction)
            // A degenerate direction means the joints resolved to the same point; aiming with
            // it would produce a random ray.
            guard length > 1e-5 else { return (false, .zero, .zero, false) }

            var pinching = false
            if let thumb = jointPosition(.thumbTip) {
                let gap = simd_distance(tip, thumb)
                let wasPinching = (anchor.chirality == .left) ? leftPinching : rightPinching
                pinching = wasPinching ? (gap < Self.pinchOpenDistance)
                                       : (gap < Self.pinchCloseDistance)
            }

            return (true, base, direction / length, pinching)
        }

        let left  = sample(anchors.leftHand)
        let right = sample(anchors.rightHand)
        leftPinching  = left.pinching
        rightPinching = right.pinching

        bridge.updateHands(withLeftValid: left.valid,
                           leftOrigin: left.origin,
                           leftForward: left.forward,
                           leftPinching: left.pinching,
                           rightValid: right.valid,
                           rightOrigin: right.origin,
                           rightForward: right.forward,
                           rightPinching: right.pinching)
    }

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
