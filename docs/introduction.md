# Introduction

This plugin publishes RTSP cameras to Apple HomeKit through
[OpenBridge](https://github.com/nubisco/openbridge), using ffmpeg to move the
video. Everything stays on your network.

## Why another camera plugin

[homebridge-camera-ffmpeg](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg)
has worked well for years, and much of what is here was learned from it. The
difference is the shape of the configuration and what that costs you.

That plugin asks you to supply ffmpeg's arguments:

```json
"source": "-rtsp_transport tcp -i rtsp://user:pass@192.168.1.138:554/stream1"
```

Three things follow from that string.

**Your camera password is in a value that gets logged.** The source is printed
when a stream starts, so the password lands in the log, in any screenshot of the
log, and in anything pasted into a support thread. It cannot be redacted
reliably either, because the plugin did not compose the string and does not know
which part is a secret.

**You are responsible for ffmpeg's command line.** A wrong flag produces a
camera that silently never appears, and the plugin cannot tell you what is
wrong because it never understood the string in the first place.

**Nothing can be validated.** A typo in the URL, a missing scheme, a duplicate
camera name: all of it reaches ffmpeg as-is.

Here a camera is described by its parts. The URL, username, password and
transport are separate fields, the arguments are built from them, and a URL with
credentials embedded is **refused at startup** with an explanation rather than
quietly accepted.

## What else is different

**Redaction covers ffmpeg's own output.** ffmpeg echoes the URL it was given in
its diagnostics, so redacting only our log lines would still leak the password
through stderr.

**Snapshots are bounded.** A camera that has dropped off the network does not
refuse the connection, it never answers, and ffmpeg waits a very long time. A
snapshot request against such a camera was observed taking **133 seconds**,
long after HomeKit had given up. Here they time out, are cached, and are shared
between concurrent requests, so a Home app opening does not start four ffmpeg
processes against one camera.

**A stale frame beats a broken tile.** When a capture fails and an earlier frame
exists, the earlier frame is served.

**Resolutions come from your configuration.** Offering HomeKit a resolution the
camera is not configured to deliver makes it ask for something that never
arrives, and the tile stays black.

## What it does not do yet

- **No audio.** Two-way audio and doorbell support are not implemented.
- **No motion or doorbell events.** Streaming and snapshots only.
- **No recording (HKSV).** HomeKit Secure Video is a much larger surface.

If you need those today, homebridge-camera-ffmpeg remains the more complete
plugin, and it works through OpenBridge's Homebridge compatibility layer.

## Next

- [Installation](/installation)
- [Finding your stream URL](/finding-streams)
- [Configuration](/configuration)
