# [2.0.0](https://github.com/nubisco/openbridge-camera-platform/compare/v1.1.0...v2.0.0) (2026-10-23)


* feat!: require Node.js 22.23.4 or newer ([a534f9f](https://github.com/nubisco/openbridge-camera-platform/commit/a534f9fa01681ec9f6a7291a3fd32df65d30a38a))


### BREAKING CHANGES

* Node.js 20 is no longer supported. Node 20 reached end of
life in April 2026 and gets no security fixes, so it stays exposed to the
October 2026 Node.js security release (the Brotli remote code execution
CVE-2026-111497 and the TLS hostname verification bypasses). Node 22
releases before 22.23.4 are affected by the same release. Run OpenBridge on
Node.js 22.23.4 or newer, or any Node 24 release, before updating this
plugin.

# [1.1.0](https://github.com/nubisco/openbridge-camera-platform/compare/v1.0.0...v1.1.0) (2026-09-29)


### Features

* report camera reachability, so the device stops showing as never-reported ([d560782](https://github.com/nubisco/openbridge-camera-platform/commit/d560782bc2c21a41f853628a620294e572d72c79))

# 1.0.0 (2026-09-29)


### Bug Fixes

* keep homebridge-camera-ffmpeg's accessory UUIDs so rooms survive the swap ([820fcd7](https://github.com/nubisco/openbridge-camera-platform/commit/820fcd7a1a2b391c82a64cb237e94515f4afd737))


### Features

* RTSP camera platform for OpenBridge ([ce2872e](https://github.com/nubisco/openbridge-camera-platform/commit/ce2872efb767cdabb541d9f87c3b8e360b662225))
