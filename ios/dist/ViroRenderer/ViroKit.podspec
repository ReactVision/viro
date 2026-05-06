Pod::Spec.new do |s|
  s.name                = 'ViroKit'
  s.version             = '1.0'
  s.summary             = 'Framework containing the ViroRenderer'
  s.description         = <<-DESC
    ViroKit is the core rendering framework for ViroReact.

    ARCore SDK Integration (Optional):
    ViroKit is built with weak linking for ARCore frameworks, making them optional.
    To enable Cloud Anchors, Geospatial, or Scene Semantics features:

    1. Add ARCore pods to your Podfile:
       pod 'ARCore/CloudAnchors', '~> 1.51.0'  # For Cloud Anchors
       pod 'ARCore/Geospatial', '~> 1.51.0'    # For Geospatial API
       pod 'ARCore/Semantics', '~> 1.51.0'     # For Scene Semantics

    2. Add the ViroKit weak linking post_install hook to your Podfile.
       See: https://github.com/ReactVision/viro#arcore-setup

    Without these pods, ViroKit works normally but ARCore features return
    isAvailable = false at runtime.
  DESC
  s.source              = { :path => '.' } # source is required, but path will be defined in user's Podfile (this value will be ignored).
  s.vendored_frameworks = 'ViroKit.framework'
  s.homepage            = 'https://reactvision.xyz'
  s.license             = {:type => 'Copyright', :text => "Copyright 2025 ReactVision" }
  s.author              = 'ReactVision'
  s.requires_arc        = true
  s.platform            = :ios, '13.0'
  s.visionos.deployment_target = '1.0'
  s.dependency 'React'

  # visionOS requires CompositorServices for the immersive render loop.
  # Metal and MetalKit are available on both iOS and visionOS.
  s.visionos.frameworks = ['Metal', 'MetalKit', 'CompositorServices', 'ARKit']

  # ARCore frameworks and Firebase dependencies are weak-linked via post_install hook
  # This prevents linker errors when ARCore pods are not installed
  # The following frameworks are weakly linked when ARCore is enabled:
  #   - ARCoreBase, ARCoreGARSession, ARCoreCloudAnchors, ARCoreGeospatial,
  #     ARCoreSemantics, ARCoreTFShared
  #   - FBLPromises, GoogleDataTransport, GoogleUtilities
  #   - FirebaseABTesting, FirebaseCore, FirebaseCoreInternal,
  #     FirebaseInstallations, FirebaseRemoteConfig, FirebaseRemoteConfigInterop,
  #     FirebaseSharedSwift
  #
  # The weak linking is applied conditionally via the Expo plugin or manually
  # via post_install hook (see scripts/viro_post_install.rb for non-Expo users)
end
