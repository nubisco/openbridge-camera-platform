import { describe, it, expect } from 'vitest'
import { parseConfig } from '../src/config.js'
import { resolutionsFor } from '../src/resolutions.js'

const ok = { cameras: [{ name: 'Living Room', url: 'rtsp://192.168.1.138:554/stream1' }] }

describe('config validation', () => {
  it('fills in defaults that are decisions, not placeholders', () => {
    const result = parseConfig(ok)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const camera = result.value.cameras[0]!
    expect(camera.transport).toBe('tcp') // survives packet loss
    expect(camera.maxFps).toBe(15)
    expect(camera.maxStreams).toBe(2) // a phone and an Apple TV
    expect(camera.transcode).toBe(false) // copying is free
    expect(camera.snapshotTimeoutMs).toBe(10_000)
  })

  it('refuses credentials embedded in the URL', () => {
    // The whole point of the structured config. A password inside the URL
    // cannot be redacted reliably once it is part of a string someone else
    // composed, and it ends up in logs and screenshots.
    const result = parseConfig({ cameras: [{ name: 'A', url: 'rtsp://user:pass@192.168.1.138:554/s' }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems[0]!.message).toMatch(/must not embed credentials/)
  })

  it('rejects something that is not an RTSP URL', () => {
    const result = parseConfig({ cameras: [{ name: 'A', url: '-i rtsp://host/s -rtsp_transport tcp' }] })
    expect(result.ok).toBe(false)
  })

  it('reports every problem at once rather than only the first', () => {
    const result = parseConfig({ cameras: [{ name: '', url: 'nope' }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.length).toBeGreaterThan(1)
  })

  it('refuses duplicate camera names, case-insensitively', () => {
    // Names become HomeKit accessory names, and two accessories sharing one is
    // how a camera silently replaces another.
    const result = parseConfig({
      cameras: [
        { name: 'Lobby', url: 'rtsp://a/s' },
        { name: 'lobby', url: 'rtsp://b/s' },
      ],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems[0]!.message).toMatch(/duplicate camera name/)
  })

  it('accepts an empty camera list so the plugin can start unconfigured', () => {
    const result = parseConfig({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.cameras).toEqual([])
  })

  it('accepts rtsps as well as rtsp', () => {
    expect(parseConfig({ cameras: [{ name: 'A', url: 'rtsps://host/s' }] }).ok).toBe(true)
  })
})

describe('resolutions offered to HomeKit', () => {
  it('never offers more than the camera is configured to deliver', () => {
    // Offering 1080p for a 720p camera makes HomeKit ask for something that
    // never arrives, and the tile stays black.
    const list = resolutionsFor({ maxWidth: 1280, maxHeight: 720, maxFps: 15 })
    expect(list.every(([w, h]) => w! <= 1280 && h! <= 720)).toBe(true)
    expect(list.some(([w]) => w === 1920)).toBe(false)
  })

  it('carries the configured frame rate on every entry', () => {
    expect(resolutionsFor({ maxWidth: 1920, maxHeight: 1080, maxFps: 20 }).every(([, , f]) => f === 20)).toBe(true)
  })

  it('always offers at least one resolution', () => {
    // An unusually small maximum would otherwise filter the whole list away and
    // publish a camera HomeKit can never negotiate with.
    const list = resolutionsFor({ maxWidth: 160, maxHeight: 120, maxFps: 10 })
    expect(list).toEqual([[160, 120, 10]])
  })
})
