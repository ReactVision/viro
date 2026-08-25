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
  # visionOS 26.0, not 1.0: the render loop calls LayerRenderer.Frame.queryDrawables(), which
  # arrived in 26.0, and Drawable.computeProjection(viewIndex:), which arrived in 2.0. Neither is
  # behind an availability check, so this is the version the code actually requires today.
  s.visionos.deployment_target = '26.0'

  # visionOS: CompositorServices drives the immersive render loop.
  s.visionos.frameworks = ['Metal', 'MetalKit', 'CompositorServices', 'ARKit']

  # iOS: frameworks required by source files compiled from the pod
  # (VRTObjectDetectorView uses AVFoundation + Accelerate; CoreVideo for CVPixelBuffer)
  s.ios.frameworks = ['AVFoundation', 'Accelerate', 'CoreVideo']

  # Base source files (always included)
  source_files_array = ['ViroReact/**/*.{h,m,mm,swift}']
  header_files_array = ['ViroReact/**/*.h']

  # dist/include is the header set that accompanies the prebuilt iOS library, so it belongs to
  # the iOS release path only. visionOS compiles everything out of ViroReact/ and adding these
  # would put a second copy of each header on the search path — the two disagree, since the dist
  # copies were staged for a renderer that still has OpenGL in it.
  # Assigning them under s.ios works because CocoaPods appends a platform value to the root one.
  ios_only_source_files = []
  if File.exist?(File.join(__dir__, 'dist/include'))
    ios_only_source_files << 'dist/include/**/*.{h,m,mm}'
    header_files_array << 'dist/include/*.h'
  end

  s.source_files        = source_files_array

  # public_header_files is set per platform rather than once at the root, because CocoaPods
  # *appends* a platform value to the root value instead of replacing it — so a root assignment
  # here would be impossible to narrow below.
  s.ios.source_files        = ios_only_source_files

  # Nine classes (VRT3DSceneNavigator, VRTGeometry, VRTManagedAnimation, VRTVRSceneNavigator and
  # their managers) sit loose in ios/ rather than under ios/ViroReact/, so the pattern above never
  # matches them. iOS does not notice: they are already compiled into the prebuilt libViroReact.a.
  # visionOS has no prebuilt library, so without this the link fails on their symbols.
  s.visionos.source_files = ['*.{h,m,mm}']
  s.ios.public_header_files = header_files_array

  # visionOS narrows the public surface to a single header, and it has to. ViroReactUI is Swift,
  # so `import ViroReact` builds ViroReact as a Clang module — and a module is compiled as plain
  # Objective-C, not Objective-C++. Most of these headers reach into the renderer's C++ (VRODriver.h
  # alone pulls in <vector>), which cannot parse that way. VRORendererBridge.h is the one header
  # Swift actually needs and the one that is pure Objective-C. Everything else stays reachable as
  # a private header, which is how the pod's own .mm files consume it anyway.
  s.visionos.public_header_files = ['ViroReact/VisionOS/VRORendererBridge.h']

  # iOS: exclude all VisionOS-only files (CompositorServices, Metal render loop, SwiftUI types).
  ios_exclude_files = ['ViroReact/VisionOS/**/*']

  # The published package now ships ViroReact/ as sources, because visionOS needs them: its
  # SwiftUI layer cannot be handed over as a prebuilt .a, and there is no vendored library for
  # xros at all. iOS still links the prebuilt one, so its implementation files must be kept out
  # of the compile or every symbol would be defined twice — once here, once in the archive.
  # Headers stay: 32 files import them, and public_header_files still needs them present.
  if File.exist?(File.join(__dir__, 'dist/lib/libViroReact.a'))
    ios_exclude_files << 'ViroReact/**/*.{m,mm}'
  end

  s.ios.exclude_files = ios_exclude_files

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

    # View managers whose view is excluded above. Each manager exists only to construct its view,
    # so it references the class symbol directly and cannot link without it.
    'ViroReact/VRT360VideoManager.mm',
    'ViroReact/VRTMaterialVideoManager.mm',
    'ViroReact/VRTVideoSurfaceManager.mm',
    'ViroReact/VRTAnimatedImageManager.mm',
    'ViroReact/VRTCameraTextureManager.mm',
    'ViroReact/VRTCameraTextureModule.mm',
    'ViroReact/Views/VRTObjectDetectorViewManager.mm',
    'ViroReact/VRTPortalManager.mm',
    'ViroReact/VROHUDManager.mm',

    # The Cardboard-style VR scene navigator and its manager. visionOS is not a phone in a
    # headset: there is no UIScreen to size a stereo view against, and nothing else refers to
    # this pair, so both come out together.
    'VRTVRSceneNavigator.mm',
    'VRTVRSceneNavigatorManager.mm',

    # The 3D scene navigator is the OpenGL presentation path — it builds an EAGLContext and hosts
    # a VROViewScene. On visionOS the immersive space is the presentation path instead, so the
    # navigator, its manager and its module all go.
    'VRT3DSceneNavigator.mm',
    'VRT3DSceneNavigatorManager.mm',
    'VRT3DSceneNavigatorModule.mm',

    # ios/VRTUIImageWrapper.m is a second copy of ViroReact/Utility/VRTUIImageWrapper.m. The
    # root-level pattern above sweeps up both, and two definitions of the same class do not link.
    'VRTUIImageWrapper.m',
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
