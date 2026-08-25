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

  # iOS: exclude all VisionOS-only files (CompositorServices, Metal render loop, SwiftUI types).
  s.ios.exclude_files = ['ViroReact/VisionOS/**/*']

  # visionOS: Swift SwiftUI files are owned by ViroReactUI pod so the app can
  # `import ViroReactUI` (pure-Swift pod → importable without use_frameworks!).
  # ViroReact keeps the ObjC/C++ bridge (VRORendererBridge) on visionOS.
  # visionOS: the Swift SwiftUI files are owned by ViroReactUI (above), plus every source
  # whose backend is absent from the visionOS renderer. Measured, not guessed: each group
  # below is a set of files that cannot compile or link for xros, established by compiling
  # all 116 .mm files against the visionOS xcframework (2026-08-23). 88 of them do compile;
  # these are the other 28.
  #
  # See development_docs/VISIONOS_BUILD_AND_DISTRIBUTION.md and
  # plans/visionos-component-sweep.md for the per-component consequences.
  s.visionos.exclude_files = [
    'ViroReact/VisionOS/*.swift',

    # AR — the entire subsystem is excluded from the visionOS renderer target, so ~30
    # VROAR* classes have no symbols. visionOS ARKit is a different API surface; a real
    # port is its own milestone, not a build fix.
    'ViroReact/AR/**/*',
    'ViroReact/Utility/VRTARHitTestUtil.mm',

    # Video — VROVideoTextureiOS.cpp is not in the renderer target, and not by oversight:
    # it needs AVAsset tracksWithMediaType:, the synchronous AVPlayerItem seekToTime:, and
    # a __weak delegate the ARC-off renderer cannot hold. All three are unavailable on
    # xros. Porting means moving to the async AVFoundation API.
    'ViroReact/Views/VRT360Video.mm',
    'ViroReact/Views/VRTMaterialVideo.mm',
    'ViroReact/Views/VRTVideoSurface.mm',

    # Audio — VROAudioPlayeriOS/VROAudioPlayerStreamiOS are not in the renderer target and
    # the GVR sound backend is excluded outright.
    'ViroReact/Views/VRTSound.mm',
    'ViroReact/Modules/VRTSoundModule.mm',
    'ViroReact/Modules/VRTStreamingAudioModule.mm',
    'ViroReact/VRTSoundManager.mm',

    # Camera and vision — visionOS grants no passthrough camera access without an
    # enterprise entitlement, so this is structural rather than a porting gap.
    # VRTObjectDetectorView additionally imports iOS ARKit and needs VROObjectRecognizer.
    'ViroReact/Views/VRTCameraTexture.mm',
    'ViroReact/Views/VRTObjectDetectorView.mm',

    # Animated images — only VROAnimatedTextureOpenGL exists; there is no Metal equivalent
    # yet. This one is a genuine gap rather than a platform limit.
    'ViroReact/Views/VRTAnimatedImage.mm',

    # Portals — VROPortal::traversePortals returns the root and stops on visionOS, so
    # nested portals do not exist. A portal is recursive by definition.
    'ViroReact/Views/VRTPortal.mm',

    # HUD — sizes itself from [UIScreen mainScreen] applicationFrame, and the renderer's
    # VRODebugHUD is excluded anyway. Neither has a meaning in an ImmersiveSpace.
    'ViroReact/Views/VRTHUDComponent.mm',

    # These two import headers that do not exist anywhere in the repository
    # (VRTButton.h, VROTextManager.h). That is not a visionOS problem — the podspec globs
    # them into every platform, so they cannot compile for iOS either. Excluded here to
    # unblock xros; the real fix is to delete them or restore the headers.
    'ViroReact/Views/VRTButton.mm',
    'ViroReact/VROTextManager.mm',
  ]

  if File.exist?(File.join(__dir__, 'dist/lib/libViroReact.a'))
    s.ios.vendored_libraries = 'dist/lib/libViroReact.a'
  end

  # React Native dependencies
  # 32 files in ViroReact import <ViroKit/ViroKit.h>, so this dependency was always real —
  # it simply went undeclared. On iOS that is survivable: ViroKit is a plain framework and its
  # headers land in Pods/Headers/Public early enough that the compile finds them anyway. On
  # visionOS it ships as an xcframework, whose headers are staged by a build phase on the
  # ViroKit target, and without a declared dependency Xcode has no reason to run that phase
  # first — so every ViroKit import fails while the headers sit in the package, unextracted.
  s.dependency 'ViroKit'
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
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/ViroReact"',
      '"$(PODS_TARGET_SRCROOT)/dist/include"',
      '"$(PODS_ROOT)/Headers/Public"',
      '"$(PODS_ROOT)/Headers/Public/ViroKit"',
      '"$(PODS_ROOT)/ViroKit/dist/include"',
      '"$(PODS_ROOT)/ViroKit/Headers"',
      # visionOS ships ViroKit as an xcframework rather than a plain framework, and CocoaPods
      # stages the selected slice's headers here. The paths above assume the older layout and
      # resolve to nothing on xros, so without this every `#import <ViroKit/...>` in the VRT
      # layer fails — the headers exist, they are just somewhere these paths never look.
      '"${PODS_XCFRAMEWORKS_BUILD_DIR}/ViroKit/Headers"'
    ].join(' '),
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) RCT_NEW_ARCH_ENABLED=1',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -std=c++17'
  }

end
