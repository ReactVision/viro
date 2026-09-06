require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../package.json')))

# ViroReactUI — pure-Swift visionOS SwiftUI layer for ViroReact.
#
# Split from ViroReact so the app can `import ViroReactUI` in App.swift without
# needing use_frameworks!. Mixed ObjC+Swift static pods don't produce an
# importable Swift module; a pure-Swift pod does.
#
# The app's visionos/Podfile should include both:
#   pod 'ViroKit',     :path => '...'
#   pod 'ViroReact',   :path => '...'
#   pod 'ViroReactUI', :path => '...'
#
# Then in App.swift:
#   import ViroReactUI
#   // ViroImmersiveSpaceView, viroImmersiveSpaceController(), ViroImmersiveSpace.id

Pod::Spec.new do |s|
  s.name                = 'ViroReactUI'
  s.version             = package['version']
  s.summary             = 'SwiftUI layer for ViroReact on visionOS'
  s.source              = { :git => 'https://github.com/ReactVision/viro.git', :tag => "v#{s.version}" }
  s.homepage            = 'https://github.com/ReactVision/viro'
  s.license             = { :type => 'MIT', :file => '../LICENSE' }
  s.author              = 'ReactVision'
  s.requires_arc        = true

  # visionOS 26.0, not 1.0: the render loop calls LayerRenderer.Frame.queryDrawables(), which
  # arrived in 26.0, and Drawable.computeProjection(viewIndex:), which arrived in 2.0. Neither is
  # behind an availability check, so this is the version the code actually requires today.
  s.platform                       = :visionos, '26.0'
  s.visionos.deployment_target     = '26.0'

  # Only the Swift SwiftUI files — no ObjC, so the module is importable
  # by the host app without use_frameworks!.
  s.source_files = ['ViroReact/VisionOS/*.swift']

  s.visionos.frameworks = ['Metal', 'MetalKit', 'CompositorServices', 'ARKit']

  # VRORendererBridge (ObjC) lives in ViroReact; ViroKit provides the renderer xcframework.
  s.dependency 'ViroReact'
  s.dependency 'ViroKit'

  s.pod_target_xcconfig = {
    'SWIFT_VERSION'    => '5.0',
    'DEFINES_MODULE'   => 'YES',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_ROOT)/Headers/Public/ViroReact"',
      '"$(PODS_ROOT)/Headers/Public/ViroKit"',
      '"$(PODS_TARGET_SRCROOT)/ViroReact"',
    ].join(' ')
  }
end
