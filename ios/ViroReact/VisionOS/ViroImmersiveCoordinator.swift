// ViroImmersiveCoordinator.swift
// ViroReact — VisionOS
//
// Observable singleton that bridges the React Native native module
// (VRTVisionOSModule) with the SwiftUI ImmersiveSpace layer.
//
// The native module posts NSNotifications; the SwiftUI modifier
// (View.viroImmersiveSpaceController()) receives them and calls
// openImmersiveSpace / dismissImmersiveSpace from the SwiftUI environment.
//
// This indirection is necessary because SwiftUI environment actions can only
// be called from within the SwiftUI view hierarchy — not from ObjC/C++ code.

#if os(visionOS)
import SwiftUI
import CompositorServices

@available(visionOS 1.0, *)
@Observable
public final class ViroImmersiveCoordinator {

    // MARK: - Singleton

    public static let shared = ViroImmersiveCoordinator()
    private init() {}

    // MARK: - State

    /// True while the ImmersiveSpace is open and rendering.
    public private(set) var isImmersiveActive: Bool = false

    /// The currently running renderer (held to prevent ARC collection).
    var activeRenderer: ViroImmersiveRenderer?

    // MARK: - SwiftUI environment actions (set by the modifier)

    var openAction:    OpenImmersiveSpaceAction?
    var dismissAction: DismissImmersiveSpaceAction?

    // MARK: - Commands from native module

    /// Open the Viro ImmersiveSpace with the given style.
    /// - Parameter styleString: "mixed" | "full" | "progressive"
    func enter(styleString: String) async {
        guard let open = openAction else {
            print("[Viro] VisionOS: openAction not set — add .viroImmersiveSpaceController() to your root view")
            return
        }
        guard !isImmersiveActive else { return }

        let result = await open(id: ViroImmersiveSpace.id)
        switch result {
        case .opened:
            isImmersiveActive = true
        case .userCancelled:
            print("[Viro] VisionOS: ImmersiveSpace open was cancelled by the user")
        case .error(let error):
            print("[Viro] VisionOS: ImmersiveSpace open error: \(error)")
        @unknown default:
            break
        }
    }

    /// Dismiss the Viro ImmersiveSpace.
    func exit() async {
        guard let dismiss = dismissAction else { return }
        guard isImmersiveActive else { return }
        await dismiss()
        isImmersiveActive = false
        activeRenderer?.stopRenderLoop()
        activeRenderer = nil
    }
}
#endif  // os(visionOS)
