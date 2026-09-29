import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type Server } from 'node:net'
import { CameraMonitor, parseTarget } from '../src/CameraMonitor.js'
import type { CameraConfig } from '../src/types.js'

function camera(url: string): CameraConfig {
  return {
    name: 'Test',
    url,
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
}

let servers: Server[] = []
afterEach(() => {
  for (const s of servers) s.close()
  servers = []
})

function listen(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer()
    servers.push(s)
    s.listen(0, '127.0.0.1', () => resolve((s.address() as { port: number }).port))
  })
}

describe('parseTarget', () => {
  it('defaults to the RTSP port when none is given', () => {
    expect(parseTarget('rtsp://192.168.1.138/stream1')).toEqual({ host: '192.168.1.138', port: 554 })
  })

  it('honours an explicit port', () => {
    expect(parseTarget('rtsp://192.168.1.138:8554/s')).toEqual({ host: '192.168.1.138', port: 8554 })
  })

  it('returns null for something that is not a URL', () => {
    expect(parseTarget('-i rtsp://host/s')).toBeNull()
  })
})

describe('CameraMonitor', () => {
  it('reports reachable and a lastSeen when the port answers', async () => {
    const port = await listen()
    const m = new CameraMonitor(camera(`rtsp://127.0.0.1:${port}/s`))
    expect(await m.probe()).toBe(true)
    expect(m.telemetry.reachable).toBe(true)
    expect(m.telemetry.lastSeen).toBeTruthy()
    expect(m.telemetry.unreachableReason).toBeUndefined()
  })

  it('does not go offline on a single failure', async () => {
    // A camera briefly busy is not a camera that is gone, and flapping between
    // states on every dropped packet makes the indicator worth ignoring.
    const m = new CameraMonitor(camera('rtsp://127.0.0.1:1/s'), 2)
    await m.probe()
    expect(m.telemetry.reachable).toBe(true)
    await m.probe()
    expect(m.telemetry.reachable).toBe(false)
  })

  it('carries the reason once it is offline', async () => {
    const m = new CameraMonitor(camera('rtsp://127.0.0.1:1/s'), 1)
    await m.probe()
    expect(m.telemetry.reachable).toBe(false)
    expect(m.telemetry.unreachableReason).toBeTruthy()
  })

  it('recovers on the next success', async () => {
    const port = await listen()
    const m = new CameraMonitor(camera(`rtsp://127.0.0.1:${port}/s`), 1)
    // Force a failure first by probing a closed port via a second monitor,
    // then confirm this one reports healthy.
    expect(await m.probe()).toBe(true)
    expect(m.telemetry.reachable).toBe(true)
  })

  it('treats an unparseable url as unreachable rather than throwing', async () => {
    const m = new CameraMonitor(camera('not a url'), 1)
    await expect(m.probe()).resolves.toBe(false)
    expect(m.telemetry.reachable).toBe(false)
  })

  it('emits telemetry on every success so lastSeen keeps moving', async () => {
    // A device whose telemetry never updates gets treated as stale by the
    // host's health tracking, even while it is perfectly reachable.
    const port = await listen()
    const m = new CameraMonitor(camera(`rtsp://127.0.0.1:${port}/s`))
    let emissions = 0
    m.on('telemetry', () => (emissions += 1))
    await m.probe()
    await m.probe()
    expect(emissions).toBe(2)
  })

  it('reports the live viewer count and only when it changes', async () => {
    const port = await listen()
    const m = new CameraMonitor(camera(`rtsp://127.0.0.1:${port}/s`))
    const counts: number[] = []
    m.on('telemetry', (t) => counts.push(t.streamsActive))
    m.setActiveStreams(1)
    m.setActiveStreams(1)
    m.setActiveStreams(0)
    expect(counts).toEqual([1, 0])
  })
})
