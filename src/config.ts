import { z } from 'zod'

/**
 * Config validation.
 *
 * Every default here is a decision rather than a placeholder, and the comments
 * say which. A camera plugin that starts with a half-valid configuration wastes
 * an evening of someone's time: the stream simply never appears in HomeKit and
 * nothing says why. So this refuses to start instead, naming each problem.
 */

const RTSP_URL = /^rtsps?:\/\/[^\s]+$/i

const urlWithoutCredentials = z
  .string()
  .regex(RTSP_URL, 'must be an rtsp:// or rtsps:// URL')
  // Credentials in the URL are the thing this plugin exists to stop. They end
  // up in logs, in screenshots and in pasted config, and they cannot be
  // redacted reliably once they are part of a string someone else composed.
  .refine((u) => !/^rtsps?:\/\/[^/@]*@/i.test(u), {
    message: 'must not embed credentials: put them in the username and password fields',
  })

export const CameraSchema = z.object({
  name: z.string().min(1),
  url: urlWithoutCredentials,
  username: z.string().optional(),
  password: z.string().optional(),
  transport: z.enum(['tcp', 'udp']).default('tcp'),
  snapshotUrl: urlWithoutCredentials.optional(),

  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),

  maxWidth: z.number().int().positive().default(1920),
  maxHeight: z.number().int().positive().default(1080),
  // 15 rather than 30: HomeKit tiles are small, most cameras deliver 15 happily,
  // and halving the frame rate halves the work on a low-powered bridge host.
  maxFps: z.number().int().positive().max(60).default(15),
  maxBitrateKbps: z.number().int().positive().default(2000),
  // Two viewers covers a phone and an Apple TV. Each stream is another ffmpeg
  // process, and on a Pi the fourth one is what makes the first three stutter.
  maxStreams: z.number().int().positive().max(8).default(2),
  audio: z.boolean().default(false),
  transcode: z.boolean().default(false),

  snapshotCacheSeconds: z.number().nonnegative().default(10),
  // HomeKit gives up on a slow snapshot itself and shows a stale tile. Ten
  // seconds is already generous; the plugin this replaces was observed taking
  // 133 seconds on a camera that had stopped answering, holding the request
  // open the whole time.
  snapshotTimeoutMs: z.number().int().positive().default(10_000),
})

export const PlatformSchema = z.object({
  cameras: z.array(CameraSchema).default([]),
  ffmpegPath: z.string().optional(),
  debug: z.boolean().default(false),
})

export type ParsedPlatformConfig = z.infer<typeof PlatformSchema>

export interface ConfigProblem {
  path: string
  message: string
}

/** Parses config, returning either the value or every problem found. */
export function parseConfig(
  raw: unknown,
): { ok: true; value: ParsedPlatformConfig } | { ok: false; problems: ConfigProblem[] } {
  const result = PlatformSchema.safeParse(raw)
  if (result.success) {
    const duplicates = findDuplicateNames(result.data.cameras.map((c) => c.name))
    if (duplicates.length > 0) {
      return {
        ok: false,
        problems: duplicates.map((name) => ({
          path: 'cameras',
          // Names become HomeKit accessory names, and two accessories sharing
          // one is how a camera silently replaces another.
          message: `duplicate camera name "${name}": each camera needs its own`,
        })),
      }
    }
    return { ok: true, value: result.data }
  }
  return {
    ok: false,
    problems: result.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
  }
}

function findDuplicateNames(names: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const name of names) {
    const key = name.trim().toLowerCase()
    if (seen.has(key)) duplicates.add(name)
    seen.add(key)
  }
  return [...duplicates]
}
