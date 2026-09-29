import { connect } from 'node:net'
import { EventEmitter } from 'node:events'
import type { CameraConfig } from './types.js'

export interface CameraTelemetry {
  reachable: boolean
  unreachableReason?: string
  /** ISO timestamp of the last successful reach, absent until the first one. */
  lastSeen?: string
  /** How many HomeKit viewers are streaming right now. */
  streamsActive: number
}

export type MonitorEvents = {
  telemetry: [CameraTelemetry]
}

/**
 * Watches whether a camera is actually there.
 *
 * Without this a camera registered as a device reports nothing at all, so
 * OpenBridge draws it with the grey "never reported" dot and the inspector
 * says "No telemetry yet" forever. That is worse than useless: a camera that
 * has been unplugged for a week looks exactly like one that is fine.
 *
 * The probe is a bare TCP connect to the RTSP port rather than an ffmpeg run.
 * Opening a real stream every minute for every camera would be an absurd cost
 * for a liveness check, and a camera that accepts a connection on 554 is the
 * thing a stream request needs anyway. ICMP is deliberately not used: plenty of
 * cameras ignore ping while serving RTSP perfectly well.
 */
export class CameraMonitor extends EventEmitter<MonitorEvents> {
  private timer: NodeJS.Timeout | null = null
  private consecutiveFailures = 0
  private offline = false
  private lastSeen: string | undefined
  private lastReason: string | undefined
  private streams = 0

  constructor(
    readonly camera: CameraConfig,
    private readonly failuresBeforeOffline = 2,
    private readonly probeTimeoutMs = 4000,
  ) {
    super()
  }

  get telemetry(): CameraTelemetry {
    return {
      reachable: !this.offline,
      ...(this.offline && this.lastReason ? { unreachableReason: this.lastReason } : {}),
      ...(this.lastSeen ? { lastSeen: this.lastSeen } : {}),
      streamsActive: this.streams,
    }
  }

  /** Called by the streaming delegate so the device view shows live viewers. */
  setActiveStreams(count: number): void {
    if (count === this.streams) return
    this.streams = count
    this.emit('telemetry', this.telemetry)
  }

  async probe(): Promise<boolean> {
    const target = parseTarget(this.camera.url)
    if (!target) {
      this.recordFailure('camera url could not be parsed')
      return false
    }

    try {
      await tcpProbe(target.host, target.port, this.probeTimeoutMs)
      this.recordSuccess()
      return true
    } catch (err) {
      this.recordFailure(err instanceof Error ? err.message : String(err))
      return false
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0
    this.lastSeen = new Date().toISOString()
    const wasOffline = this.offline
    this.offline = false
    this.lastReason = undefined
    // Emitted on every success, not only on recovery: `lastSeen` moves each
    // time, and a device whose telemetry never updates is treated as stale.
    this.emit('telemetry', this.telemetry)
    if (wasOffline) return
  }

  private recordFailure(reason: string): void {
    this.consecutiveFailures += 1
    this.lastReason = reason
    if (!this.offline && this.consecutiveFailures >= this.failuresBeforeOffline) {
      this.offline = true
      this.emit('telemetry', this.telemetry)
    }
  }

  start(intervalSeconds: number): void {
    this.stop()
    void this.probe()
    this.timer = setInterval(() => void this.probe(), intervalSeconds * 1000)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

/** Host and port from an rtsp URL, defaulting to 554. */
export function parseTarget(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname) return null
    return { host: parsed.hostname, port: parsed.port ? Number(parsed.port) : 554 }
  } catch {
    return null
  }
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port })
    let settled = false
    const done = (err?: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve()
    }
    socket.setTimeout(timeoutMs, () => done(new Error(`no answer from ${host}:${port} within ${timeoutMs}ms`)))
    socket.once('connect', () => done())
    socket.once('error', (err) => done(err))
  })
}
