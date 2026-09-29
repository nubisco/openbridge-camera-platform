# Configuration

```json
{
  "name": "@nubisco/openbridge-camera-platform",
  "enabled": true,
  "config": {
    "debug": false,
    "cameras": [
      {
        "name": "Living Room",
        "url": "rtsp://192.168.1.138:554/stream1",
        "snapshotUrl": "rtsp://192.168.1.138:554/stream2",
        "username": "viewer",
        "password": "…",
        "manufacturer": "TP-Link",
        "model": "Tapo",
        "maxWidth": 1920,
        "maxHeight": 1080,
        "maxFps": 15,
        "maxStreams": 2
      }
    ]
  }
}
```

## Platform options

| Option       | Default | Meaning                                                           |
| ------------ | ------- | ----------------------------------------------------------------- |
| `ffmpegPath` | —       | Explicit binary, when the bundled and PATH lookups are both wrong |
| `debug`      | `false` | Log the full ffmpeg command line, credentials still redacted      |

## Camera options

| Option                                  | Default        | Meaning                                      |
| --------------------------------------- | -------------- | -------------------------------------------- |
| `name`                                  | required       | HomeKit accessory name, and must be unique   |
| `url`                                   | required       | `rtsp://` or `rtsps://`, without credentials |
| `username`, `password`                  | —              | Camera credentials                           |
| `snapshotUrl`                           | `url`          | Optional substream for stills                |
| `transport`                             | `tcp`          | `tcp` or `udp`                               |
| `manufacturer`, `model`, `serialNumber` | —              | Shown in HomeKit's accessory details         |
| `maxWidth`, `maxHeight`                 | `1920`, `1080` | Largest stream offered                       |
| `maxFps`                                | `15`           | Frame rate offered                           |
| `maxBitrateKbps`                        | `2000`         | Bitrate ceiling when re-encoding             |
| `maxStreams`                            | `2`            | Concurrent viewers                           |
| `transcode`                             | `false`        | Re-encode rather than copy                   |
| `snapshotCacheSeconds`                  | `10`           | How long a still stays fresh                 |
| `snapshotTimeoutMs`                     | `10000`        | Give up on a still after this long           |

## The defaults are decisions

**`transport: tcp`.** RTSP over UDP loses packets and produces tearing. TCP
costs a little latency and is right for almost every camera.

**`maxFps: 15`.** HomeKit tiles are small, most cameras deliver 15 happily, and
halving the frame rate halves the work on a low-powered bridge host.

**`maxStreams: 2`.** A phone and an Apple TV. Each stream is another ffmpeg
process, and on a Pi the fourth is what makes the first three stutter.

**`transcode: false`.** Copying the camera's existing H.264 is free. Re-encoding
costs a great deal of CPU and is only needed when a camera emits a profile
HomeKit refuses. Turn it on when the tile stays black and the log shows a codec
complaint, not before.

**`snapshotTimeoutMs: 10000`.** HomeKit gives up on a slow snapshot itself. Ten
seconds is already generous.

## Credentials

Put them in `username` and `password`. A URL with credentials embedded is
**rejected at startup**:

```
Configuration is invalid:
  cameras.0.url: must not embed credentials: put them in the username and password fields
```

That is deliberate. Credentials inside a URL are printed whenever the URL is
logged, and cannot be redacted reliably once they are part of a string the
plugin did not compose. Kept separate, they are injected only when arguments are
built and replaced with `***` in anything printed, including ffmpeg's own
error output.

## Validation

Every problem is reported at once, so one restart tells you everything:

```
Configuration is invalid:
  cameras.0.name: String must contain at least 1 character(s)
  cameras.0.url: must be an rtsp:// or rtsps:// URL
  cameras: duplicate camera name "Lobby": each camera needs its own
```

Duplicate names are refused because names become HomeKit accessory names, and
two accessories sharing one is how a camera silently replaces another.
