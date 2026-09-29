/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn, type ChildProcess } from 'node:child_process'
import { createSocket } from 'node:dgram'
import { describeCommand, redact, snapshotArgs, streamArgs } from './ffmpeg/args.js'
import type { SnapshotCache } from './SnapshotCache.js'
import type { CameraConfig } from './types.js'

export interface DelegateLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

interface SessionRecord {
  process?: ChildProcess
  targetAddress: string
  videoPort: number
  videoSsrc: number
  videoSrtp: string
  localPort: number
}

/**
 * Bridges one camera to HomeKit's streaming protocol.
 *
 * HomeKit negotiates in two steps: `prepareStream` reserves ports and exchanges
 * SRTP keys, then `handleStreamRequest` starts, reconfigures or stops the flow.
 * ffmpeg is only spawned on start, so a client that negotiates and walks away
 * costs nothing.
 */
export class StreamingDelegate {
  private sessions = new Map<string, SessionRecord>()
  controller: any
  /** Set by the platform so the device view can show live viewer count. */
  onStreamCountChange?: (count: number) => void

  constructor(
    private readonly hap: any,
    private readonly camera: CameraConfig,
    private readonly ffmpegPath: string,
    private readonly snapshots: SnapshotCache,
    private readonly log: DelegateLogger,
    private readonly debug: boolean,
  ) {}

  /**
   * HomeKit's snapshot request.
   *
   * Never rejects when a previous image exists: a stale frame beats the broken
   * tile HomeKit shows on an error, and a camera that is slow right now is
   * usually fine a moment later.
   */
  async handleSnapshotRequest(
    request: { width: number; height: number },
    callback: (error?: Error | null, buffer?: Buffer) => void,
  ): Promise<void> {
    const args = snapshotArgs(this.camera, { width: request.width, height: request.height })
    if (this.debug) this.log.debug(`snapshot: ${describeCommand(this.ffmpegPath, args)}`)

    try {
      const image = await this.snapshots.get(
        this.camera.name,
        args,
        this.camera.snapshotCacheSeconds,
        this.camera.snapshotTimeoutMs,
      )
      callback(null, image)
    } catch (err) {
      const message = redact(err instanceof Error ? err.message : String(err))
      const stale = this.snapshots.lastKnown(this.camera.name)
      if (stale) {
        this.log.warn(`${this.camera.name}: snapshot failed (${message}), serving the last known frame`)
        callback(null, stale)
        return
      }
      this.log.warn(`${this.camera.name}: snapshot failed (${message})`)
      callback(new Error(message))
    }
  }

  /** Reserves a local port and returns the SRTP parameters HomeKit needs. */
  async prepareStream(request: any, callback: (error?: Error | null, response?: any) => void): Promise<void> {
    try {
      const localPort = await reserveUdpPort()
      const videoSsrc = this.hap.CameraController.generateSynchronisationSource()

      this.sessions.set(request.sessionID, {
        targetAddress: request.targetAddress,
        videoPort: request.video.port,
        videoSsrc,
        videoSrtp: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]).toString('base64'),
        localPort,
      })

      callback(null, {
        video: {
          port: localPort,
          ssrc: videoSsrc,
          srtp_key: request.video.srtp_key,
          srtp_salt: request.video.srtp_salt,
        },
      })
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)))
    }
  }

  handleStreamRequest(request: any, callback: (error?: Error | null) => void): void {
    switch (request.type) {
      case 'start':
        this.startStream(request, callback)
        return
      case 'reconfigure':
        // Nothing to do: the stream is copied, so bitrate hints do not change
        // what ffmpeg is producing. Answering rather than ignoring keeps
        // HomeKit from treating the session as dead.
        callback()
        return
      case 'stop':
        this.stopStream(request.sessionID)
        callback()
        return
      default:
        callback()
    }
  }

  private startStream(request: any, callback: (error?: Error | null) => void): void {
    const session = this.sessions.get(request.sessionID)
    if (!session) {
      callback(new Error('No prepared session for this stream request'))
      return
    }

    const args = streamArgs(this.camera, {
      width: request.video.width,
      height: request.video.height,
      fps: request.video.fps,
      bitrateKbps: request.video.max_bit_rate,
      targetAddress: session.targetAddress,
      videoPort: session.videoPort,
      videoSsrc: session.videoSsrc,
      videoSrtp: session.videoSrtp,
      videoPayloadType: request.video.pt,
      videoMtu: request.video.mtu ?? 1316,
    })

    if (this.debug) this.log.debug(`stream: ${describeCommand(this.ffmpegPath, args)}`)

    const child = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    session.process = child

    let started = false
    const done = (err?: Error) => {
      if (started) return
      started = true
      callback(err ?? null)
    }

    child.stderr?.on('data', (chunk: Buffer) => {
      // Redacted before it reaches the log: ffmpeg echoes the URL it was given,
      // credentials included, in its own error output.
      const text = redact(chunk.toString().trim())
      if (text) this.log.debug(`${this.camera.name}: ${text}`)
    })

    child.on('error', (err) => {
      this.log.error(`${this.camera.name}: failed to start ffmpeg: ${redact(err.message)}`)
      done(err)
    })

    child.on('close', (code) => {
      this.sessions.delete(request.sessionID)
      // Code 255 is ffmpeg's own exit on SIGKILL, which is how a stop is
      // implemented here, so it is not worth reporting as a failure.
      if (code !== 0 && code !== 255 && code !== null) {
        this.log.warn(`${this.camera.name}: stream ended unexpectedly (ffmpeg exit ${code})`)
      }
      done()
    })

    this.onStreamCountChange?.(this.sessions.size)

    // ffmpeg does not announce readiness, and waiting for first output would
    // delay the HomeKit tile. Answering now is what the protocol expects.
    done()
  }

  private stopStream(sessionID: string): void {
    const session = this.sessions.get(sessionID)
    if (!session) return
    try {
      session.process?.kill('SIGKILL')
    } catch {
      /* already gone */
    }
    this.sessions.delete(sessionID)
    this.onStreamCountChange?.(this.sessions.size)
  }

  /** Kills every stream, for plugin shutdown. */
  stopAll(): void {
    for (const id of [...this.sessions.keys()]) this.stopStream(id)
  }
}

/** Asks the OS for a free UDP port by binding port 0 and reading it back. */
export function reserveUdpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4')
    socket.once('error', reject)
    socket.bind(0, () => {
      const { port } = socket.address()
      socket.close(() => resolve(port))
    })
  })
}
