import { spawn } from 'node:child_process'
import { redact } from './ffmpeg/args.js'

export interface SnapshotRunner {
  /** Runs ffmpeg with these arguments and resolves the bytes it wrote to stdout. */
  capture(args: string[], timeoutMs: number): Promise<Buffer>
}

/**
 * Captures a still frame, with a hard timeout.
 *
 * The timeout is the point. A camera that has dropped off the network does not
 * refuse a connection, it simply never answers, and ffmpeg will wait a very
 * long time. The plugin this replaces was seen holding a snapshot request for
 * **133 seconds** on exactly that: HomeKit had given up long before, and the
 * bridge was left with a stuck process per attempt.
 */
export class FfmpegSnapshotRunner implements SnapshotRunner {
  constructor(private readonly binary: string) {}

  capture(args: string[], timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const chunks: Buffer[] = []
      let stderr = ''
      let settled = false

      const finish = (err: Error | null, value?: Buffer) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (err) reject(err)
        else resolve(value!)
      }

      const timer = setTimeout(() => {
        // SIGKILL rather than SIGTERM: ffmpeg blocked on a socket read that
        // will never complete does not always act on a polite signal, and a
        // process that outlives its timeout is worse than no snapshot.
        child.kill('SIGKILL')
        finish(new Error(`Snapshot timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      child.stdout.on('data', (c: Buffer) => chunks.push(c))
      child.stderr.on('data', (c: Buffer) => {
        stderr += c.toString()
      })
      child.on('error', (err) => finish(new Error(redact(err.message))))
      child.on('close', (code) => {
        const data = Buffer.concat(chunks)
        if (code === 0 && data.length > 0) return finish(null, data)
        const detail = stderr.trim().split('\n').slice(-2).join(' ')
        finish(new Error(redact(detail || `ffmpeg exited with code ${code} and produced no image`)))
      })
    })
  }
}

interface CacheEntry {
  image: Buffer
  capturedAt: number
}

/**
 * One snapshot per camera, reused while it is fresh, with concurrent requests
 * sharing one capture.
 *
 * HomeKit asks several times in quick succession when a Home app opens, and
 * each unshared request would be another ffmpeg process pulling the same RTSP
 * stream from the same camera. Cheap hardware falls over doing that.
 */
export class SnapshotCache {
  private entries = new Map<string, CacheEntry>()
  private inFlight = new Map<string, Promise<Buffer>>()

  constructor(
    private readonly runner: SnapshotRunner,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, args: string[], cacheSeconds: number, timeoutMs: number): Promise<Buffer> {
    const cached = this.entries.get(key)
    if (cached && this.now() - cached.capturedAt < cacheSeconds * 1000) {
      return cached.image
    }

    const existing = this.inFlight.get(key)
    if (existing) return existing

    const pending = this.runner
      .capture(args, timeoutMs)
      .then((image) => {
        this.entries.set(key, { image, capturedAt: this.now() })
        return image
      })
      .finally(() => {
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, pending)
    return pending
  }

  /**
   * The last image captured, however old.
   *
   * A stale frame is better than a broken tile when a camera is temporarily
   * unreachable, as long as the caller knows it is stale and does not cache it
   * again as if it were current.
   */
  lastKnown(key: string): Buffer | undefined {
    return this.entries.get(key)?.image
  }
}
