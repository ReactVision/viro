require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../package.json')))

Pod::Spec.new do |s|
  s.name                = 'ViroReact'
  s.version             = package['version']
  s.summary             = 'Viro React Native library for AR/VR applications'
  s.source              = { :git => 'https://github.com/ReactVision/viro.git', :tag => "v#{s.version}" }
  s.homepage            = 'https://github.com/ReactVision/viro'
  s.license             = { :type => 'MIT', :file => '../LICENSE' }
  s.author              = 'ReactVision'
  s.requires_arc        = true
  s.platform            = :ios, '12.0'
  s.ios.deployment_target     = '12.0'
  s.visionos.deployment_target = '1.0'

  # visionOS: CompositorServices drives the immersive render loop.
  s.visionos.frameworks = ['Metal', 'MetalKit', 'CompositorServices', 'ARKit']

  # iOS: frameworks required by source files compiled from the pod
  # (VRTObjectDetectorView uses AVFoundation + Accelerate; CoreVideo for CVPixelBuffer)
  s.ios.frameworks = ['AVFoundation', 'Accelerate', 'CoreVideo']

  # Base source files (always included)
  source_files_array = ['ViroReact/**/*.{h,m,mm,swift}']
  header_files_array = ['ViroReact/**/*.h']

  # Include dist files if they exist (for release builds)
  if File.exist?(File.join(__dir__, 'dist/include'))
    source_files_array << 'dist/include/**/*.{h,m,mm}'
    header_files_array << 'dist/include/*.h'
  end

  s.source_files        = source_files_array
  s.public_header_files = header_files_array

  # visionOS-only sources: keep them out of the iOS build so consumers running
  # `pod install` for iOS don't pull CompositorServices / VRODriverVisionOS.h
  # into a target where those symbols don't exist.
  s.ios.exclude_files = ['ViroReact/VisionOS/**/*']

  if File.exist?(File.join(__dir__, 'dist/lib/libViroReact.a'))
    s.vendored_libraries = 'dist/lib/libViroReact.a'
  end

  # React Native dependencies
  s.dependency 'React-Core'

  # ONNX Runtime is distributed as a vendored dynamic xcframework (onnxruntime.xcframework).
  # When the xcframework is present in ios/dist/Frameworks/, enable inference by setting:
  #   GCC_PREPROCESSOR_DEFINITIONS = $(inherited) VIRO_ONNXRUNTIME_AVAILABLE=1
  # Until then, VRTObjectDetectorView compiles with the camera pipeline active
  # and inference returning empty results.
  if File.exist?(File.join(__dir__, 'dist/Frameworks/onnxruntime.xcframework'))
    s.vendored_frameworks = [
      'dist/ViroRenderer/ViroKit.framework',
      'dist/Frameworks/onnxruntime.xcframework'
    ]
    s.pod_target_xcconfig = {
      'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) RCT_NEW_ARCH_ENABLED=1 VIRO_ONNXRUNTIME_AVAILABLE=1'
    }
  end

  # Fabric dependencies
  s.dependency 'React-RCTFabric'
  s.dependency 'React-Fabric'
  s.dependency 'React-FabricComponents'

  # Fabric-specific build configuration
  s.pod_target_xcconfig = {
    'SWIFT_VERSION' => '5.0',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/ViroReact"',
      '"$(PODS_TARGET_SRCROOT)/dist/include"',
      '"$(PODS_ROOT)/Headers/Public"',
      '"$(PODS_ROOT)/Headers/Public/ViroKit"',
      '"$(PODS_ROOT)/ViroKit/dist/include"',
      '"$(PODS_ROOT)/ViroKit/Headers"'
    ].join(' '),
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) RCT_NEW_ARCH_ENABLED=1',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -std=c++17'
  }

end
