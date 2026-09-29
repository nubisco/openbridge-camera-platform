import type { CameraConfig } from '../types.js'

/**
 * Builds ffmpeg argument lists, and keeps credentials out of anything printed.
 *
 * Arguments are an array, never a string. A string would have to be split
 * somewhere, and a camera path containing a space (or a password containing
 * one) is then a command that runs with the wrong arguments.
 */

/** Puts the credentials into the URL at the last possible moment. */
export function authenticatedUrl(camera: Pick<CameraConfig, 'url' | 'username' | 'password'>, url?: string): string {
  const target = url ?? camera.url
  if (!camera.username) return target

  const parsed = new URL(target)
  parsed.username = encodeURIComponent(camera.username)
  if (camera.password) parsed.password = encodeURIComponent(camera.password)
  return parsed.toString()
}

/**
 * Replaces the userinfo of any RTSP URL in a string with `***`.
 *
 * Applied to every line before it reaches a log or an error message. ffmpeg
 * prints the URL it was given in its own diagnostics, so redacting only our
 * own log lines would still leak the password through ffmpeg's stderr, which
 * is exactly how camera passwords end up in a pasted support log.
 */
export function redact(text: string): string {
  return text.replace(/(rtsps?:\/\/)[^@\s/]+@/gi, '$1***@')
}

export interface SnapshotArgsOptions {
  width?: number
  height?: number
}

/** ffmpeg arguments for a single still frame. */
export function snapshotArgs(camera: CameraConfig, options: SnapshotArgsOptions = {}): string[] {
  const source = authenticatedUrl(camera, camera.snapshotUrl ?? camera.url)
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-rtsp_transport',
    camera.transport,
    // Analyse less before deciding it understands the stream. The default
    // spends up to five seconds on a stream whose format we already know, and
    // a snapshot is on the path of someone opening the Home app.
    '-analyzeduration',
    '1000000',
    '-probesize',
    '1000000',
    '-i',
    source,
    '-frames:v',
    '1',
  ]

  const width = options.width ?? camera.maxWidth
  const height = options.height ?? camera.maxHeight
  // Preserve aspect ratio and never upscale: HomeKit asks for the tile size,
  // which is often larger than a camera's substream, and stretching a 640px
  // substream to 1920 costs time and looks worse than the original.
  args.push('-vf', `scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease`)
  args.push('-f', 'image2', '-')

  return args
}

export interface StreamArgsOptions {
  width: number
  height: number
  fps: number
  bitrateKbps: number
  /** Destination for the SRTP video stream. */
  targetAddress: string
  videoPort: number
  videoSsrc: number
  videoSrtp: string
  videoPayloadType: number
  videoMtu: number
}

/** ffmpeg arguments for a live SRTP stream to a HomeKit client. */
export function streamArgs(camera: CameraConfig, options: StreamArgsOptions): string[] {
  const source = authenticatedUrl(camera)

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-rtsp_transport',
    camera.transport,
    '-i',
    source,
    '-an',
    '-sn',
    '-dn',
  ]

  if (camera.transcode) {
    // Only when a camera emits something HomeKit will not take. `veryfast` and
    // `zerolatency` because a live view that is correct but three seconds
    // behind is worse than one that is slightly softer.
    args.push(
      '-codec:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-r',
      String(options.fps),
      '-vf',
      `scale='min(${options.width},iw)':'min(${options.height},ih)':force_original_aspect_ratio=decrease`,
      '-b:v',
      `${options.bitrateKbps}k`,
      '-bufsize',
      `${options.bitrateKbps * 2}k`,
      '-maxrate',
      `${options.bitrateKbps}k`,
    )
  } else {
    // Copy: no re-encoding, which is what makes several cameras viable at once
    // on a Raspberry Pi.
    args.push('-codec:v', 'copy')
  }

  args.push(
    '-payload_type',
    String(options.videoPayloadType),
    '-ssrc',
    String(options.videoSsrc),
    '-f',
    'rtp',
    '-srtp_out_suite',
    'AES_CM_128_HMAC_SHA1_80',
    '-srtp_out_params',
    options.videoSrtp,
    `srtp://${options.targetAddress}:${options.videoPort}?rtcpport=${options.videoPort}&pkt_size=${options.videoMtu}`,
  )

  return args
}

/** A command line safe to log: arguments joined, credentials replaced. */
export function describeCommand(binary: string, args: string[]): string {
  return redact([binary, ...args].join(' '))
}
