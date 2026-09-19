// ViroImmersiveSpace.swift
// ViroReact — VisionOS
//
// SwiftUI ImmersiveSpace content view for Viro.
//
// ── Usage in your app ────────────────────────────────────────────────────────
//
// In your SwiftUI App struct (visionOS only), add the ImmersiveSpace scene
// alongside your WindowGroup:
//
//   #if os(visionOS)
//   import ViroReact
//   #endif
//
//   @main struct MyApp: App {
//       @State private var immersionStyle: ImmersionStyle = .mixed
//
//       var body: some Scene {
//           WindowGroup {
//               ContentView()
//                   .viroImmersiveSpaceController()  // <-- add this modifier
//           }
//
//           #if os(visionOS)
//           ImmersiveSpace(id: ViroImmersiveSpace.id) {
//               ViroImmersiveSpaceView()
//           }
//           .immersionStyle(selection: $immersionStyle, in: .mixed, .full, .progressive)
//           #endif
//       }
//   }
//
// The .viroImmersiveSpaceController() modifier wires up the
// openImmersiveSpace / dismissImmersiveSpace actions so the native module
// can control the space from JavaScript.
//
// ─────────────────────────────────────────────────────────────────────────────

#if os(visionOS)
import SwiftUI
import CompositorServices

// MARK: - Public constants

public enum ViroImmersiveSpace {
    /// The scene identifier used by openImmersiveSpace / dismissImmersiveSpace.
    public static let id = "ViroImmersive"
}

// MARK: - ImmersiveSpace content view

/// The content view placed inside the ImmersiveSpace scene.
/// Contains a CompositorLayer that drives the Viro Metal render loop.
@available(visionOS 1.0, *)
public struct ViroImmersiveSpaceView: ImmersiveSpaceContent {

    public init() {}

    public var body: some ImmersiveSpaceContent {
        CompositorLayer(configuration: ViroLayerConfiguration()) { layerRenderer in
            let renderer = ViroImmersiveRenderer(layerRenderer: layerRenderer)
            // Keep a reference so ARC doesn't collect the renderer.
            ViroImmersiveCoordinator.shared.activeRenderer = renderer
            renderer.startRenderLoop()
        }
    }
}

// MARK: - Layer configuration

/// Configures the CompositorServices layer for Viro rendering.
@available(visionOS 1.0, *)
struct ViroLayerConfiguration: CompositorLayerConfiguration {
    func makeConfiguration(
        capabilities: LayerRenderer.Capabilities,
        configuration: inout LayerRenderer.Configuration
    ) {
        NSLog("[Viro] LayerCfg supportedColorFormats=%@",
              capabilities.supportedColorFormats.map { $0.rawValue } as NSArray)
        NSLog("[Viro] LayerCfg supportedDepthFormats=%@",
              capabilities.supportedDepthFormats.map { $0.rawValue } as NSArray)

        // rgba16Float is Apple's recommended format for visionOS immersive rendering.
        // bgra8Unorm_sRGB may be silently composited to black on device (visionOS 26).
        configuration.depthFormat = .depth32Float
        configuration.colorFormat = .rgba16Float

        // .layered delivers ONE MTLTextureType2DArray for both eyes and requires
        // a SINGLE render pass with renderTargetArrayLength=2 + viewport arrays.
        // Our current per-eye loop uses two separate slice passes which the
        // compositor silently ignores for .layered → black screen on device.
        // Force .dedicated so each eye gets its own MTLTexture2D, matching the
        // simulator path that already works.
        // TODO: implement single-pass layered rendering to re-enable .layered.
        configuration.layout = .dedicated

        // ── Tracking areas ───────────────────────────────────────────────────
        //
        // This is how a Metal immersive app gets the system's own gaze-driven hover. The app
        // registers a tracking area per hoverable object, writes that area's render value into
        // an extra texture during its render pass, and the compositor applies the highlight
        // afterwards using that texture and the wearer's gaze.
        //
        // The gaze itself is never handed to the app — the system draws the effect. Which means
        // the hover looks exactly like every other visionOS control, rather than like something
        // we approximated.
        //
        // visionOS 26.0 and later. Older systems simply skip this and fall back to the ray.
        if #available(visionOS 26.0, *) {
            let formats = capabilities.supportedTrackingAreasFormats
            NSLog("[Viro] LayerCfg supportedTrackingAreasFormats=%@",
                  formats.map { $0.rawValue } as NSArray)
            if let format = formats.first {
                configuration.trackingAreasFormat = format
                // renderTarget so our pass can write ids into it; shaderRead because the
                // compositor samples it after we are done.
                configuration.trackingAreasUsage = [.renderTarget, .shaderRead]
                NSLog("[Viro] tracking areas enabled, format=%lu", format.rawValue)
            } else {
                NSLog("[Viro] tracking areas unsupported on this layer — hover falls back to the ray")
            }
        }

        // Foveation also requires rasterizationRateMap on the render pass.
        // Keep disabled until that support is added.
        configuration.isFoveationEnabled = false
    }
}

// MARK: - SwiftUI modifier for host apps

/// View modifier that attaches the openImmersiveSpace / dismissImmersiveSpace
/// environment actions to the ViroImmersiveCoordinator singleton.
///
/// Apply to the root view of your WindowGroup:
///   ContentView().viroImmersiveSpaceController()
@available(visionOS 1.0, *)
private struct ViroImmersiveSpaceControllerModifier: ViewModifier {
    @Environment(\.openImmersiveSpace)    var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) var dismissImmersiveSpace

    func body(content: Content) -> some View {
        content
            .task {
                // Forward environment actions into the coordinator so the
                // native module can trigger them from a non-SwiftUI context.
                ViroImmersiveCoordinator.shared.openAction    = openImmersiveSpace
                ViroImmersiveCoordinator.shared.dismissAction = dismissImmersiveSpace
            }
            .onReceive(
                NotificationCenter.default.publisher(
                    for: .VRTEnterImmersiveSpace)
            ) { notification in
                let style = notification.userInfo?["style"] as? String ?? "mixed"
                Task {
                    await ViroImmersiveCoordinator.shared.enter(styleString: style)
                }
            }
            .onReceive(
                NotificationCenter.default.publisher(
                    for: .VRTExitImmersiveSpace)
            ) { _ in
                Task {
                    await ViroImmersiveCoordinator.shared.exit()
                }
            }
    }
}

@available(visionOS 1.0, *)
public extension View {
    /// Wires up the Viro ImmersiveSpace open/dismiss actions.
    /// Call on the root view of your app's WindowGroup.
    func viroImmersiveSpaceController() -> some View {
        modifier(ViroImmersiveSpaceControllerModifier())
    }
}

// MARK: - Notification names

extension Notification.Name {
    static let VRTEnterImmersiveSpace = Notification.Name("VRTEnterImmersiveSpace")
    static let VRTExitImmersiveSpace  = Notification.Name("VRTExitImmersiveSpace")
}

#endif  // os(visionOS)
