/**
 * Camera configuration.
 *
 * The important difference from homebridge-camera-ffmpeg is that a camera is
 * described by its parts rather than by a raw ffmpeg argument string. That
 * plugin asks for:
 *
 *     "source": "-rtsp_transport tcp -i rtsp://user:pass@192.168.1.138:554/stream1"
 *
 * which makes the person configuring it responsible for ffmpeg's command line,
 * puts their camera password in a field that is printed to the log on every
 * stream, and gives the plugin nothing it can validate. Here the URL, the
 * credentials and the transport are separate fields, the arguments are built
 * from them, and the password never appears in a log line.
 */

export type RtspTransport = 'tcp' | 'udp'

export interface CameraConfig {
  name: string
  /** `rtsp://host:554/path`. Credentials go in their own fields, not here. */
  url: string
  username?: string
  password?: string
  /** TCP unless a camera genuinely needs UDP: TCP survives packet loss. */
  transport: RtspTransport
  /** A second, lower-resolution stream used for snapshots when the camera has one. */
  snapshotUrl?: string
  manufacturer?: string
  model?: string
  serialNumber?: string

  maxWidth: number
  maxHeight: number
  maxFps: number
  maxBitrateKbps: number
  /** Concurrent HomeKit viewers. Each one is another ffmpeg process. */
  maxStreams: number
  audio: boolean

  /**
   * Re-encode instead of copying the camera's H.264 stream.
   *
   * Copying is free and is right for almost every camera. Re-encoding costs a
   * lot of CPU on a Raspberry Pi and is only needed when a camera emits a
   * profile HomeKit refuses.
   */
  transcode: boolean

  /** How long a cached snapshot stays fresh. */
  snapshotCacheSeconds: number
  /** Give up on a snapshot after this long rather than making HomeKit wait. */
  snapshotTimeoutMs: number
}

export interface PlatformConfig {
  cameras: CameraConfig[]
  /** Explicit ffmpeg path, when the bundled and PATH lookups are both wrong. */
  ffmpegPath?: string
  /** Log the full ffmpeg command line, with credentials still redacted. */
  debug: boolean
}
