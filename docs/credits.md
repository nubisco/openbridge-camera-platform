# Credits

**[homebridge-camera-ffmpeg](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg)**
by Sunoo and its contributors. It has worked reliably for years, and it is the
reason anyone can put an RTSP camera in HomeKit at all. This plugin differs in
the shape of its configuration and in how it handles credentials, snapshots and
failure, not in the idea, which is theirs.

**[ffmpeg](https://ffmpeg.org/)** does the actual work, and
**[ffmpeg-for-homebridge](https://github.com/homebridge-plugins/ffmpeg-for-homebridge)**
makes a suitable static build available without asking every user to compile one.

**[hap-nodejs](https://github.com/homebridge/HAP-NodeJS)** implements the
HomeKit Accessory Protocol, including the camera controller this plugin plugs
into.

**[OpenBridge](https://github.com/nubisco/openbridge)** provides the bridge, the
device model and the plugin host.

## Sponsorship

MIT licensed and free. If it is useful,
[sponsorship](https://github.com/sponsors/joseporto) helps: camera integrations
need hardware to test against.
