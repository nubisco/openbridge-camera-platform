import { describe, it, expect, vi } from 'vitest'
import { SnapshotCache, type SnapshotRunner } from '../src/SnapshotCache.js'

function runner(impl: (args: string[], timeoutMs: number) => Promise<Buffer>): SnapshotRunner {
  return { capture: vi.fn(impl) as SnapshotRunner['capture'] }
}

describe('SnapshotCache', () => {
  it('serves a cached frame while it is fresh', async () => {
    let calls = 0
    const r = runner(async () => Buffer.from(`frame-${++calls}`))
    let now = 1000
    const cache = new SnapshotCache(r, () => now)

    expect((await cache.get('cam', [], 10, 5000)).toString()).toBe('frame-1')
    now += 5000
    expect((await cache.get('cam', [], 10, 5000)).toString()).toBe('frame-1')
    expect(calls).toBe(1)
  })

  it('re-captures once the cache window has passed', async () => {
    let calls = 0
    const r = runner(async () => Buffer.from(`frame-${++calls}`))
    let now = 1000
    const cache = new SnapshotCache(r, () => now)

    await cache.get('cam', [], 10, 5000)
    now += 11_000
    expect((await cache.get('cam', [], 10, 5000)).toString()).toBe('frame-2')
  })

  it('shares one capture between concurrent requests', async () => {
    // HomeKit asks several times as a Home app opens. Without sharing, each
    // request is another ffmpeg pulling the same RTSP stream from the same
    // camera, which is what makes cheap hardware fall over.
    let calls = 0
    const r = runner(async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return Buffer.from('frame')
    })
    const cache = new SnapshotCache(r)

    const all = await Promise.all([
      cache.get('cam', [], 10, 5000),
      cache.get('cam', [], 10, 5000),
      cache.get('cam', [], 10, 5000),
    ])
    expect(calls).toBe(1)
    expect(all.every((b) => b.toString() === 'frame')).toBe(true)
  })

  it('keeps cameras separate', async () => {
    const r = runner(async (args) => Buffer.from(args[0] ?? ''))
    const cache = new SnapshotCache(r)
    expect((await cache.get('a', ['alpha'], 10, 5000)).toString()).toBe('alpha')
    expect((await cache.get('b', ['beta'], 10, 5000)).toString()).toBe('beta')
  })

  it('does not cache a failure, so the next attempt tries again', async () => {
    let calls = 0
    const r = runner(async () => {
      calls += 1
      if (calls === 1) throw new Error('camera asleep')
      return Buffer.from('frame')
    })
    const cache = new SnapshotCache(r)

    await expect(cache.get('cam', [], 10, 5000)).rejects.toThrow('camera asleep')
    expect((await cache.get('cam', [], 10, 5000)).toString()).toBe('frame')
  })

  it('clears the in-flight slot after a failure so it cannot wedge', async () => {
    const r = runner(async () => {
      throw new Error('nope')
    })
    const cache = new SnapshotCache(r)
    await expect(cache.get('cam', [], 10, 5000)).rejects.toThrow()
    await expect(cache.get('cam', [], 10, 5000)).rejects.toThrow()
  })

  it('exposes the last good frame for use when a camera goes quiet', async () => {
    // A stale frame beats the broken tile HomeKit draws on an error.
    const r = runner(async () => Buffer.from('good'))
    const cache = new SnapshotCache(r)
    await cache.get('cam', [], 10, 5000)
    expect(cache.lastKnown('cam')?.toString()).toBe('good')
    expect(cache.lastKnown('other')).toBeUndefined()
  })

  it('passes the timeout through to the runner', async () => {
    // The timeout is the whole point: an unreachable camera does not refuse the
    // connection, it never answers, and the plugin this replaces was seen
    // holding a snapshot request for 133 seconds.
    const r = runner(async () => Buffer.from('x'))
    const cache = new SnapshotCache(r)
    await cache.get('cam', ['-i', 'x'], 10, 1234)
    expect(r.capture).toHaveBeenCalledWith(['-i', 'x'], 1234)
  })
})
