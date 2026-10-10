Pod::Spec.new do |s|
  s.name           = 'LocationIntegrity'
  s.version        = '1.0.0'
  s.summary        = 'Detects faked locations and tampered devices for attendance self-marking'
  s.description    = 'Detects faked locations and tampered devices for attendance self-marking'
  s.license        = 'UNLICENSED'
  s.author         = 'Smart Gurukul'
  s.homepage       = 'https://smartgurukul.org'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
