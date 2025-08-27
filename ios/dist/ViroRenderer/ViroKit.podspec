Pod::Spec.new do |s|
  s.name                = 'ViroKit'
  s.version             = '1.0'
  s.summary             = 'Framework containing the ViroRenderer'
  s.source              = { :path => '.' } # source is required, but path will be defined in user's Podfile (this value will be ignored).
  s.vendored_frameworks = 'ViroKit.framework'
  s.homepage            = 'https://reactvision.xyz'
  s.license             = {:type => 'Copyright', :text => "Copyright 2025 ReactVision" }
  s.author              = 'ReactVision'
  s.requires_arc        = true
  s.platform            = :ios, '17.6'
  s.dependency 'React'
end
