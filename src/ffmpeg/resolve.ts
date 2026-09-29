import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

export interface FfmpegResolution {
  path: string
  /** Where it came from, so a support question can be answered in one line. */
  source: 'config' | 'bundled' | 'path'
}

/**
 * Finds an ffmpeg to use, in order of how much the operator meant it.
 *
 * 1. `ffmpegPath` in config, because an explicit choice wins over any guess.
 * 2. The binary from `ffmpeg-for-homebridge`, if installed. It is an
 *    **optional** dependency deliberately: it downloads a static build at
 *    install time and has no artefact for every platform, so depending on it
 *    outright would make this plugin uninstallable on the hosts it lacks,
 *    including musl-based ones. Missing it is survivable, a failed install is
 *    not.
 * 3. `ffmpeg` on PATH.
 *
 * Returns null rather than throwing so the caller can report every camera's
 * situation at once instead of dying on the first.
 */
export function resolveFfmpeg(configuredPath?: string): FfmpegResolution | null {
  if (configuredPath && isExecutable(configuredPath)) {
    return { path: configuredPath, source: 'config' }
  }

  const bundled = resolveBundled()
  if (bundled) return { path: bundled, source: 'bundled' }

  const onPath = findOnPath('ffmpeg')
  if (onPath) return { path: onPath, source: 'path' }

  return null
}

function resolveBundled(): string | null {
  try {
    // The package's main export is the path to the binary it downloaded.
    const mod = require('ffmpeg-for-homebridge') as unknown
    const candidate = typeof mod === 'string' ? mod : (mod as { default?: string })?.default
    if (candidate && isExecutable(candidate)) return candidate
  } catch {
    // Not installed, which is an expected state for an optional dependency.
  }
  return null
}

export function findOnPath(binary: string): string | null {
  const paths = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const dir of paths) {
    const candidate = join(dir, binary)
    if (isExecutable(candidate)) return candidate
  }
  return null
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}
