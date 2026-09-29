import { describe, it, expect } from 'vitest'
import { authenticatedUrl, redact, snapshotArgs, streamArgs, describeCommand } from '../src/ffmpeg/args.js'
import type { CameraConfig } from '../src/types.js'

const CAMERA: CameraConfig = {
  name: 'Living Room',
  url: 'rtsp://192.168.1.138:554/stream1',
  username: 'nubiscoCamera1',
  password: 'sup3r-s3cret',
  transport: 'tcp',
  maxWidth: 1920,
  maxHeight: 1080,
  maxFps: 15,
  maxBitrateKbps: 2000,
  maxStreams: 2,
  audio: false,
  transcode: false,
  snapshotCacheSeconds: 10,
  snapshotTimeoutMs: 10_000,
}

describe('credentials', () => {
  it('injects them into the URL only when building arguments', () => {
    expect(authenticatedUrl(CAMERA)).toBe('rtsp://nubiscoCamera1:sup3r-s3cret@192.168.1.138:554/stream1')
  })

  it('percent-encodes characters that would otherwise break the URL', () => {
    // A password containing @ or / silently produces a URL pointing somewhere
    // else, which is a connection failure nobody can diagnose from the message.
    const url = authenticatedUrl({ url: 'rtsp://host/s', username: 'a@b', password: 'p/w@rd' })
    expect(url).toBe('rtsp://a%40b:p%2Fw%40rd@host/s')
  })

  it('leaves the URL alone when there is no username', () => {
    expect(authenticatedUrl({ url: 'rtsp://host/s' })).toBe('rtsp://host/s')
  })
})

describe('redaction', () => {
  it('removes credentials from a URL', () => {
    expect(redact('rtsp://user:pass@192.168.1.138:554/stream1')).toBe('rtsp://***@192.168.1.138:554/stream1')
  })

  it("redacts ffmpeg's own error output, not just our log lines", () => {
    // ffmpeg echoes the URL it was given. Redacting only our own messages would
    // still leak the password through stderr, which is what ends up pasted into
    // a support thread.
    const stderr =
      '[rtsp @ 0x5] method DESCRIBE failed: 401\nrtsp://admin:hunter2@10.0.0.9:554/h264: Server returned 401'
    const clean = redact(stderr)
    expect(clean).not.toContain('hunter2')
    expect(clean).toContain('rtsp://***@10.0.0.9:554/h264')
  })

  it('handles several URLs in one string', () => {
    const text = 'a rtsp://u1:p1@h1/s and rtsp://u2:p2@h2/s'
    expect(redact(text)).toBe('a rtsp://***@h1/s and rtsp://***@h2/s')
  })

  it('leaves a URL without credentials untouched', () => {
    expect(redact('rtsp://192.168.1.138:554/stream1')).toBe('rtsp://192.168.1.138:554/stream1')
  })

  it('never lets a password reach a logged command line', () => {
    const line = describeCommand('/usr/bin/ffmpeg', snapshotArgs(CAMERA))
    expect(line).not.toContain('sup3r-s3cret')
    expect(line).toContain('rtsp://***@')
  })
})

describe('argument building', () => {
  it('produces an array, never a string', () => {
    // A joined string has to be split again somewhere, and a path or password
    // containing a space then runs a different command than intended.
    const args = snapshotArgs(CAMERA)
    expect(Array.isArray(args)).toBe(true)
    expect(args).toContain('-frames:v')
  })

  it('honours the configured transport', () => {
    const args = snapshotArgs({ ...CAMERA, transport: 'udp' })
    expect(args[args.indexOf('-rtsp_transport') + 1]).toBe('udp')
  })

  it('prefers a dedicated snapshot stream when one is configured', () => {
    const args = snapshotArgs({ ...CAMERA, snapshotUrl: 'rtsp://192.168.1.138:554/stream2' })
    expect(args.join(' ')).toContain('stream2')
  })

  it('never upscales a snapshot beyond the source', () => {
    // HomeKit asks for the tile size, which is routinely larger than a camera's
    // substream. min(w,iw) keeps the original rather than stretching it.
    const args = snapshotArgs(CAMERA, { width: 1920, height: 1080 })
    const vf = args[args.indexOf('-vf') + 1]!
    expect(vf).toContain("'min(1920,iw)'")
    expect(vf).toContain('force_original_aspect_ratio=decrease')
  })

  it('copies the video stream by default rather than re-encoding', () => {
    const args = streamArgs(CAMERA, baseStreamOptions())
    expect(args.join(' ')).toContain('-codec:v copy')
    expect(args.join(' ')).not.toContain('libx264')
  })

  it('re-encodes only when asked', () => {
    const args = streamArgs({ ...CAMERA, transcode: true }, baseStreamOptions())
    const joined = args.join(' ')
    expect(joined).toContain('libx264')
    expect(joined).toContain('zerolatency')
  })

  it('sends SRTP to the address HomeKit asked for', () => {
    const args = streamArgs(CAMERA, baseStreamOptions())
    expect(args[args.length - 1]).toContain('srtp://10.0.0.5:5000')
    expect(args).toContain('AES_CM_128_HMAC_SHA1_80')
  })
})

function baseStreamOptions() {
  return {
    width: 1280,
    height: 720,
    fps: 15,
    bitrateKbps: 800,
    targetAddress: '10.0.0.5',
    videoPort: 5000,
    videoSsrc: 1,
    videoSrtp: 'AAAA',
    videoPayloadType: 99,
    videoMtu: 1316,
  }
}
