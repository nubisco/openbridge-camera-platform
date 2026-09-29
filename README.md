<p align="center">
  <img src="docs/public/logo.svg" width="120" alt="OpenBridge Camera Platform" />
</p>

# OpenBridge Camera Platform

**RTSP cameras in Apple HomeKit, through [OpenBridge](https://github.com/nubisco/openbridge).**

Structured configuration, credentials that never reach your logs, and snapshots that give up instead of hanging.

[![CI](https://github.com/nubisco/openbridge-camera-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/nubisco/openbridge-camera-platform/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@nubisco/openbridge-camera-platform)](https://www.npmjs.com/package/@nubisco/openbridge-camera-platform)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-339933)](https://www.npmjs.com/package/@nubisco/openbridge-camera-platform)
[![license](https://img.shields.io/npm/l/@nubisco/openbridge-camera-platform)](LICENSE)
[![Docs](https://img.shields.io/website?url=https%3A%2F%2Fdocs.nubisco.io%2Fopenbridge-camera-platform%2F&label=docs)](https://docs.nubisco.io/openbridge-camera-platform/)

## Quick Start

```sh
npm install -g @nubisco/openbridge-camera-platform
```

```json
{
  "name": "@nubisco/openbridge-camera-platform",
  "enabled": true,
  "config": {
    "cameras": [
      {
        "name": "Living Room",
        "url": "rtsp://192.168.1.138:554/stream1",
        "username": "viewer",
        "password": "…",
        "manufacturer": "TP-Link",
        "model": "Tapo"
      }
    ]
  }
}
```

That is a complete camera. Everything else has a default that is a decision rather than a placeholder.

## What it does differently

**Credentials are fields, not part of a command string.** The usual approach asks you to write the
ffmpeg invocation yourself:

```json
"source": "-rtsp_transport tcp -i rtsp://user:pass@192.168.1.138:554/stream1"
```

That makes you responsible for ffmpeg's command line, and it puts your camera password in a value
that gets printed on every stream. Here the URL, username, password and transport are separate.
Configuration that embeds credentials in the URL is **rejected at startup** with an explanation.

**Passwords are redacted everywhere, including ffmpeg's own output.** ffmpeg echoes the URL it was
given in its diagnostics, so redacting only our log lines would still leak the password through
stderr, which is exactly what ends up pasted into a support thread.

**Snapshots time out.** A camera that has dropped off the network does not refuse the connection, it
simply never answers, and ffmpeg will wait a very long time. Snapshots are bounded (10s by default),
cached, and shared between concurrent requests, so a Home app opening does not start four ffmpeg
processes against one camera. When a capture fails and a previous frame exists, the stale frame is
served rather than a broken tile.

**Arguments are arrays, never strings.** A camera path or password containing a space cannot turn
into a different command.

**Resolutions are derived from your configuration.** Offering HomeKit a resolution the camera is not
configured to deliver makes it ask for something that never arrives, and the tile stays black.

**ffmpeg is found, not assumed.** Explicit `ffmpegPath`, then the optional `ffmpeg-for-homebridge`
binary, then `PATH`. That package is an _optional_ dependency deliberately: it downloads a static
build at install time and has no artefact for every platform, so depending on it outright would make
this plugin uninstallable on the hosts it lacks.

## Configuration

| Option                   | Default         | Meaning                                                         |
| ------------------------ | --------------- | --------------------------------------------------------------- |
| `name`                   | required        | HomeKit accessory name. Must be unique                          |
| `url`                    | required        | `rtsp://host:554/path`, without credentials                     |
| `username` / `password`  | —               | Camera credentials                                              |
| `snapshotUrl`            | —               | Optional lower-resolution substream for stills                  |
| `transport`              | `tcp`           | `tcp` survives packet loss; use `udp` only if a camera needs it |
| `maxWidth` / `maxHeight` | `1920` / `1080` | Largest stream offered                                          |
| `maxFps`                 | `15`            | HomeKit tiles are small and most cameras deliver 15 happily     |
| `maxStreams`             | `2`             | Concurrent viewers. Each one is another ffmpeg process          |
| `transcode`              | `false`         | Re-encode. Expensive; only for cameras HomeKit refuses          |
| `snapshotCacheSeconds`   | `10`            | How long a still stays fresh                                    |
| `snapshotTimeoutMs`      | `10000`         | Give up rather than making HomeKit wait                         |

## Documentation

**[docs.nubisco.io/openbridge-camera-platform](https://docs.nubisco.io/openbridge-camera-platform/)**

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

```sh
npm install
npm run quality:check
```

## Security

Camera credentials are involved, so please report vulnerabilities privately rather than in a public
issue. See [SECURITY.md](SECURITY.md).

## Support this project

Maintaining camera integrations means testing against real hardware, which costs money.

- ❤️ [Sponsor via GitHub](https://github.com/sponsors/joseporto)

## License

[MIT](LICENSE) © Nubisco
