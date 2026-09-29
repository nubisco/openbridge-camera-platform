# Finding your stream URL

Every camera needs an `rtsp://` URL. Cameras rarely document theirs clearly, so
this is usually the fiddly part.

## Common paths

| Make            | Typical URL                                              |
| --------------- | -------------------------------------------------------- |
| TP-Link Tapo    | `rtsp://<ip>:554/stream1` (main), `/stream2` (substream) |
| Reolink         | `rtsp://<ip>:554/h264Preview_01_main`                    |
| Hikvision       | `rtsp://<ip>:554/Streaming/Channels/101`                 |
| Dahua / Amcrest | `rtsp://<ip>:554/cam/realmonitor?channel=1&subtype=0`    |
| Ubiquiti UniFi  | `rtsps://<ip>:7441/<stream key>`                         |
| ONVIF generic   | `rtsp://<ip>:554/onvif1`                                 |

Most cameras need RTSP switching on first, and many want a dedicated camera
account rather than the admin login.

## Test it before configuring it

```sh
ffprobe -rtsp_transport tcp -i 'rtsp://user:pass@192.168.1.138:554/stream1'
```

A working stream prints something like:

```
Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 15 fps
```

Note the resolution and frame rate: they are what `maxWidth`, `maxHeight` and
`maxFps` should reflect. Claiming more than the camera sends does not improve
anything, and claiming a resolution it cannot produce gives you a black tile.

**This is the only place credentials belong in a URL.** In the plugin
configuration they go in `username` and `password`, and a URL containing them is
refused.

## Use the substream for snapshots

If the camera has a second, smaller stream, point `snapshotUrl` at it. A still
from a 640×360 substream is quicker to fetch and indistinguishable at the size
HomeKit draws it.

```json
{
  "url": "rtsp://192.168.1.138:554/stream1",
  "snapshotUrl": "rtsp://192.168.1.138:554/stream2"
}
```

## If it will not connect

- **401 or 403**: wrong credentials, or the camera wants a separate RTSP account
- **Connection refused**: RTSP is off, or the port is not 554
- **404 or "method DESCRIBE failed"**: right host, wrong path
- **Timeout**: nothing is listening, or a firewall is in the way
