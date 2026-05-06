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
public struct ViroImmersiveSpaceView: View {

    public init() {}

    public var body: some View {
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
        // 32-bit depth for accurate occlusion
        configuration.depthFormat = .depth32Float
        // sRGB BGRA colour
        configuration.colorFormat = .bgra8Unorm_srgb

        // Enable foveation where supported (Quest Pro / Vision Pro gaze-based)
        let foveationEnabled = capabilities.supportsFoveation
        configuration.isFoveationEnabled = foveationEnabled

        let layoutOptions: LayerRenderer.Capabilities.SupportedLayoutsOptions =
            foveationEnabled ? [.foveationEnabled] : []
        let supportedLayouts = capabilities.supportedLayouts(options: layoutOptions)

        // Layered: both eyes in a single texture array — preferred.
        // Dedicated: separate textures per eye — fallback.
        configuration.layout = supportedLayouts.contains(.layered) ? .layered : .dedicated
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
