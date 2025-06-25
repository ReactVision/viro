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
  s.ios.deployment_target = '12.0'
  
  # Base source files (always included)
  s.source_files        = 'dist/include', 'ViroReact/**/*.{h,m,mm}'
  s.public_header_files = 'dist/include/*.h', 'ViroReact/**/*.h'
  s.vendored_libraries  = 'dist/lib/libViroReact.a'
  
  # React Native dependencies
  s.dependency 'React-Core'
  
  # Conditionally include Fabric files for New Architecture
  new_arch_enabled = ENV['RCT_NEW_ARCH_ENABLED'] == '1'
  
  if new_arch_enabled
    # Include Fabric source files
    s.source_files += ', ViroFabric/**/*.{h,m,mm}'
    s.public_header_files += ', ViroFabric/**/*.h'
    
    # Fabric dependencies
    s.dependency 'React-RCTFabric'
    s.dependency 'React-Fabric'
    s.dependency 'React-FabricComponents'
    
    # Fabric-specific build configuration
    s.pod_target_xcconfig = { 
      'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
      'HEADER_SEARCH_PATHS' => [
        '"$(PODS_TARGET_SRCROOT)/ViroFabric"',
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
    
    # User target configuration for consumers
    s.user_target_xcconfig = {
      'HEADER_SEARCH_PATHS' => '"$(PODS_ROOT)/ViroReact/ViroFabric"'
    }
  else
    # Legacy architecture configuration
    s.pod_target_xcconfig = { 
      'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
      'HEADER_SEARCH_PATHS' => [
        '"$(PODS_TARGET_SRCROOT)/ViroReact"',
        '"$(PODS_TARGET_SRCROOT)/dist/include"',
        '"$(PODS_ROOT)/Headers/Public"',
        '"$(PODS_ROOT)/Headers/Public/ViroKit"',
        '"$(PODS_ROOT)/ViroKit/dist/include"',
        '"$(PODS_ROOT)/ViroKit/Headers"'
      ].join(' '),
      'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -std=c++17'
    }
  end
end
