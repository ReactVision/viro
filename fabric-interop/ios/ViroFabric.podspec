require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../../package.json')))

# Folly compiler flags to resolve folly-config.h issues
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

Pod::Spec.new do |s|
  s.name                = 'ViroFabric'
  s.version             = package['version']
  s.summary             = 'Fabric interop layer for Viro React Native'
  s.description         = 'Fabric interop layer for Viro React Native, enabling New Architecture support'
  s.homepage            = 'https://github.com/ReactVision/viro'
  s.license             = { :type => 'MIT', :file => '../../LICENSE' }
  s.author              = 'ReactVision'
  s.source              = { :git => 'https://github.com/ReactVision/viro.git', :tag => "v#{s.version}" }
  s.platform            = :ios, '12.0'
  
  s.source_files        = '*.{h,m,mm}'
  s.requires_arc        = true
  
  # Add folly compiler flags for New Architecture compatibility
  s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
  
  s.dependency 'React-Core'
  s.dependency 'ViroReact'
  s.dependency 'ViroKit'
  
  # Fabric dependencies
  s.dependency 'React-RCTFabric'
  s.dependency 'React-Fabric'
  s.dependency 'React-FabricComponents'
  
  # Ensure we're using C++17 and proper header search paths with Folly support
  s.pod_target_xcconfig = { 
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/../../node_modules/react-native/ReactCommon"',
      '"$(PODS_ROOT)/Headers/Public"',
      '"$(PODS_ROOT)/Headers/Public/ViroKit"',
      '"$(PODS_ROOT)/ViroKit/dist/include"',
      '"$(PODS_ROOT)/ViroKit/Headers"',
      '"$(PODS_ROOT)/../node_modules/@reactvision/react-viro/ios/dist/include"',
      '"$(PODS_ROOT)/../node_modules/@reactvision/react-viro/ios"',
      '"$(PODS_ROOT)/../node_modules/@reactvision/react-viro/ios/ViroReact"',
      '"$(PODS_TARGET_SRCROOT)"',
      '"$(PODS_ROOT)/RCT-Folly"'
    ].join(' '),
    'DEFINES_MODULE' => 'YES',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES',
    'OTHER_CPLUSPLUSFLAGS' => '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1'
  }
  
  # Include the iOS directory as a source directory to find all headers
  s.preserve_paths = '../../ios/**/*.h'
end
