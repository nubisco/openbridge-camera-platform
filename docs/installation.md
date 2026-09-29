# Installation

## From the OpenBridge UI

Open **Plugins**, search the marketplace for `camera`, and install
`@nubisco/openbridge-camera-platform`.

## From the command line

```sh
npm install -g @nubisco/openbridge-camera-platform
```

## Requirements

- OpenBridge, any version supporting native platform plugins
- Node 20 or newer
- **ffmpeg**, see below
- Cameras reachable from the bridge host over RTSP, usually TCP port 554

## ffmpeg

Found in this order:

1. `ffmpegPath` in the plugin configuration
2. The binary from the optional `ffmpeg-for-homebridge` package
3. `ffmpeg` on `PATH`

`ffmpeg-for-homebridge` is an **optional** dependency on purpose. It downloads a
static build at install time and does not publish an artefact for every
platform, so depending on it outright would make this plugin uninstallable on
the hosts it lacks, musl-based systems among them. A missing optional
dependency is survivable, a failed install is not.

If none of the three finds anything, the plugin refuses to start and says so.
That check happens at startup rather than at first stream, because discovering a
missing ffmpeg when someone opens the Home app is too late.

To install it yourself:

```sh
# Debian / Ubuntu / Raspberry Pi OS
sudo apt install ffmpeg

# Alpine
apk add ffmpeg

# macOS
brew install ffmpeg
```

## Give cameras fixed addresses

The plugin addresses cameras by whatever is in the URL. If that is an IP, give
the camera a DHCP reservation so it does not move. A hostname works too, if your
network resolves it.

## Next

- [Finding your stream URL](/finding-streams)
- [Configuration](/configuration)
