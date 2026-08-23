Pod::Spec.new do |s|
  s.name                = 'ViroKit'
  s.version             = '1.0'
  s.summary             = 'Framework containing the ViroRenderer (visionOS / xros)'
  s.description         = <<-DESC
    ViroKit is the core rendering framework for ViroReact.

    This is the visionOS (xros) distribution: a Metal-only build of the
    ViroRenderer packaged as an xcframework with both the device (xros-arm64)
    and simulator (xros-arm64_x86_64-simulator) slices. It plugs into the
    CompositorServices immersive render loop via VRORendererBridge.
  DESC
  s.source              = { :path => '.' } # source is required, but path is defined in the user's Podfile (this value is ignored).
  s.vendored_frameworks = 'ViroKit.xcframework'
  s.homepage            = 'https://reactvision.xyz'
  s.license             = {:type => 'Copyright', :text => "Copyright 2025 ReactVision" }
  s.author              = 'ReactVision'
  s.requires_arc        = true
  s.platform            = :visionos, '1.0'
  s.visionos.deployment_target = '1.0'
  s.dependency 'React'

  # visionOS requires CompositorServices for the immersive render loop.
  # Metal and MetalKit are available on both iOS and visionOS; ARKit provides
  # world / hand tracking.
  s.visionos.frameworks = ['Metal', 'MetalKit', 'CompositorServices', 'ARKit']
end
