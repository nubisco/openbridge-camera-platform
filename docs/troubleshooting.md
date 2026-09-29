# Troubleshooting

## Turn on debug first

```json
{ "config": { "debug": true } }
```

That logs the full ffmpeg command line, with credentials still redacted. Copy it
out, put the real credentials back, and run it by hand: ffmpeg's own error is
almost always clearer than anything a plugin can infer from it.

## The plugin will not start

**`must not embed credentials`** — the URL contains `user:pass@`. Move them to
the `username` and `password` fields.

**`must be an rtsp:// or rtsps:// URL`** — often an ffmpeg argument string
pasted from another plugin's config. Only the URL belongs here.

**`duplicate camera name`** — two cameras share a name. Names become HomeKit
accessory names and must be unique.

**`No ffmpeg found`** — see [Installation](/installation).

## The camera is in HomeKit but the tile is black

**Check the stream plays at all:**

```sh
ffprobe -rtsp_transport tcp -i 'rtsp://user:pass@192.168.1.138:554/stream1'
```

**Check the resolution you configured.** If `maxWidth` and `maxHeight` claim
more than the camera sends, HomeKit may ask for something that never arrives.
Set them to what ffprobe reports.

**Check the codec.** HomeKit needs H.264. A camera sending H.265 (HEVC) has to
be re-encoded:

```json
{ "transcode": true }
```

That is expensive. Prefer switching the camera to H.264 if it can.

**Try the substream.** A 4K main stream can be more than a small bridge host can
move. Point `url` at the substream instead.

## Snapshots are missing or stale

A camera that stops answering causes the timeout to fire and the last known
frame to be served, so a tile showing an old image usually means the camera is
unreachable rather than the plugin being wrong. Check it is reachable at the
address in the URL.

If stills are slow but streams are fine, set `snapshotUrl` to the substream.

## Streams stutter with several viewers

Each viewer is an ffmpeg process. Lower `maxStreams`, lower `maxFps`, or point
the camera at its substream. If `transcode` is on, turn it off unless a codec
problem actually requires it.

## Nothing appears in HomeKit at all

Look for this at startup:

```
No OpenBridge HAP bridge available: cameras cannot be published to HomeKit
```

The plugin could not reach the host's HAP bridge. Unlike some plugins it does
not fall back to publishing its own, because a second bridge means a second
pairing.
