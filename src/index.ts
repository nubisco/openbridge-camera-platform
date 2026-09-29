/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseConfig } from './config.js'
import { resolveFfmpeg } from './ffmpeg/resolve.js'
import { FfmpegSnapshotRunner, SnapshotCache } from './SnapshotCache.js'
import { StreamingDelegate } from './StreamingDelegate.js'
import { resolutionsFor } from './resolutions.js'
import type { CameraConfig } from './types.js'

const PLUGIN_NAME = '@nubisco/openbridge-camera-platform'

let PLUGIN_VERSION = '0.1.0'
try {
  PLUGIN_VERSION = require('../package.json').version
} catch {
  /* keep the default */
}

// OpenBridge native plugin surface, inlined because @openbridge/sdk is ESM-only
// and this package builds to CommonJS. Same reasoning as the Tuya and WiZ
// platforms.
interface PluginLogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

interface PluginContext {
  config: Record<string, unknown>
  log: PluginLogger
  reportTelemetry(deviceId: string, data: Record<string, unknown>): void
  registerDevice(device: { id: string; name: string; widgetType: string; manufacturer?: string; model?: string }): void
  registerControl(deviceId: string, controlId: string, handler: (value: unknown) => void | Promise<void>): void
  getHapBridge?(): { hap: any; bridge: any } | undefined
}

function definePlugin<T extends { manifest: { name: string; version: string } }>(plugin: T): T {
  return plugin
}

const state: { delegates: StreamingDelegate[] } = { delegates: [] }

function buildCamera(
  hap: any,
  camera: CameraConfig,
  ffmpegPath: string,
  snapshots: SnapshotCache,
  log: PluginLogger,
  debug: boolean,
) {
  const { Accessory, Service, Characteristic, uuid, Categories } = hap

  // From the name, so renaming a camera in config renames it in HomeKit on the
  // next restart rather than leaving a name nobody chose.
  const accessory = new Accessory(camera.name, uuid.generate(`camera:${camera.name}`))
  accessory.category = Categories.CAMERA

  accessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, camera.manufacturer ?? 'Nubisco')
    .setCharacteristic(Characteristic.Model, camera.model ?? 'RTSP Camera')
    .setCharacteristic(Characteristic.SerialNumber, camera.serialNumber ?? camera.name)
    .setCharacteristic(Characteristic.FirmwareRevision, PLUGIN_VERSION)

  const delegate = new StreamingDelegate(hap, camera, ffmpegPath, snapshots, log, debug)

  const controller = new hap.CameraController({
    cameraStreamCount: camera.maxStreams,
    delegate,
    streamingOptions: {
      supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
      video: {
        resolutions: resolutionsFor(camera),
        codec: {
          profiles: [hap.H264Profile.BASELINE, hap.H264Profile.MAIN, hap.H264Profile.HIGH],
          levels: [hap.H264Level.LEVEL3_1, hap.H264Level.LEVEL3_2, hap.H264Level.LEVEL4_0],
        },
      },
    },
  })

  delegate.controller = controller
  accessory.configureController(controller)
  return { accessory, delegate }
}

const plugin = definePlugin({
  manifest: {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: 'RTSP cameras in HomeKit, with structured configuration and no credentials in logs',
    author: 'José Silva',
  },

  async setup(ctx: PluginContext) {
    const parsed = parseConfig(ctx.config)
    if (!parsed.ok) {
      const issues = parsed.problems.map((p) => `  ${p.path}: ${p.message}`).join('\n')
      ctx.log.error(`Configuration is invalid:\n${issues}`)
      throw new Error('Invalid plugin configuration, check the errors above and restart')
    }

    if (parsed.value.cameras.length === 0) {
      ctx.log.warn('No cameras configured. Add each camera with its name and rtsp:// url.')
      return
    }

    // Checked here rather than at first stream: a missing ffmpeg is a setup
    // problem, and finding out when someone opens the Home app is too late.
    const ffmpeg = resolveFfmpeg(parsed.value.ffmpegPath)
    if (!ffmpeg) {
      throw new Error(
        'No ffmpeg found. Install it and put it on PATH, install the optional ffmpeg-for-homebridge package, or set ffmpegPath in the plugin configuration.',
      )
    }
    ctx.log.info(`Configuration valid, ${parsed.value.cameras.length} camera(s), ffmpeg from ${ffmpeg.source}`)
  },

  async start(ctx: PluginContext) {
    const parsed = parseConfig(ctx.config)
    if (!parsed.ok) return
    const config = parsed.value
    if (config.cameras.length === 0) return

    const ffmpeg = resolveFfmpeg(config.ffmpegPath)
    if (!ffmpeg) {
      ctx.log.error('No ffmpeg available, cameras will not be published')
      return
    }

    const hapBridge = ctx.getHapBridge?.()
    if (!hapBridge) {
      ctx.log.warn('No OpenBridge HAP bridge available: cameras cannot be published to HomeKit')
      return
    }

    const snapshots = new SnapshotCache(new FfmpegSnapshotRunner(ffmpeg.path))

    for (const camera of config.cameras) {
      const { accessory, delegate } = buildCamera(hapBridge.hap, camera, ffmpeg.path, snapshots, ctx.log, config.debug)
      state.delegates.push(delegate)
      hapBridge.bridge.addBridgedAccessory(accessory)

      // Registered as a device too, so a camera appears in OpenBridge's own
      // list rather than only inside HomeKit.
      ctx.registerDevice({
        id: `camera-${camera.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: camera.name,
        widgetType: 'camera',
        manufacturer: camera.manufacturer ?? 'Nubisco',
        model: camera.model ?? 'RTSP Camera',
      })
    }

    ctx.log.info(`Started with ${config.cameras.length} camera(s), ffmpeg at ${ffmpeg.path}`)
  },

  async stop(ctx: PluginContext) {
    for (const delegate of state.delegates) delegate.stopAll()
    state.delegates = []
    ctx.log.info('Stopped')
  },
})

export default plugin
module.exports = plugin
module.exports.default = plugin

export * from './config.js'
export * from './types.js'
export * from './ffmpeg/args.js'
export * from './ffmpeg/resolve.js'
export * from './resolutions.js'
export { SnapshotCache, FfmpegSnapshotRunner } from './SnapshotCache.js'
export { StreamingDelegate, reserveUdpPort } from './StreamingDelegate.js'
