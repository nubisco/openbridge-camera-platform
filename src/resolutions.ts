import type { CameraConfig } from './types.js'

/**
 * The resolution list HomeKit chooses from.
 *
 * Every entry must be one the camera can actually satisfy, so the list is
 * derived from the configured maximum rather than being a fixed menu: offering
 * 1080p for a camera configured at 720p makes HomeKit ask for something that
 * never arrives, and the tile stays black.
 *
 * Its own module rather than living in index.ts, because index.ts carries the
 * CommonJS interop shim the plugin host needs and cannot be imported from an
 * ESM context such as a test runner.
 */
export function resolutionsFor(camera: Pick<CameraConfig, 'maxWidth' | 'maxHeight' | 'maxFps'>): number[][] {
  const candidates = [
    [320, 180],
    [480, 270],
    [640, 360],
    [1280, 720],
    [1920, 1080],
  ]
  const allowed = candidates.filter(([w, h]) => w! <= camera.maxWidth && h! <= camera.maxHeight)
  // Always offer at least one, even for an unusually small configured maximum.
  if (allowed.length === 0) allowed.push([camera.maxWidth, camera.maxHeight])
  return allowed.map(([w, h]) => [w!, h!, camera.maxFps])
}
