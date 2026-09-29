# How it works

## Streaming

HomeKit negotiates a stream in two steps. `prepareStream` reserves a local UDP
port and exchanges SRTP keys; `handleStreamRequest` then starts, reconfigures or
stops the flow.

ffmpeg is spawned only on start, so a client that negotiates and walks away
costs nothing. Each viewer is one ffmpeg process, which is why `maxStreams`
matters on a small host.

By default the camera's H.264 stream is **copied**, not re-encoded. ffmpeg
repackages it into SRTP and sends it to the address HomeKit gave. That is nearly
free, and it is what makes several cameras workable on a Raspberry Pi.

## Snapshots

Three things happen around a still, and each exists because of a failure mode.

**A timeout.** An unreachable camera does not refuse the connection, it never
answers. ffmpeg will wait far longer than anyone wants. A snapshot against such
a camera was observed taking 133 seconds, long after HomeKit had stopped
listening, leaving a stuck process behind per attempt. Here the process is
killed with `SIGKILL` at the timeout, because a process blocked on a socket read
does not always act on a polite signal.

**A cache.** HomeKit asks repeatedly as a Home app opens. Without a cache each
request is another ffmpeg pulling the same stream from the same camera.

**Sharing.** Requests arriving while a capture is in flight wait for that one
rather than starting their own.

When a capture fails and an earlier frame exists, the earlier frame is served: a
stale image beats the broken tile HomeKit draws on an error.

## Credentials

The configured URL never contains them. They are injected when the argument list
is built, and `redact()` replaces the userinfo of any RTSP URL with `***` in
every line that could be printed.

That last part matters more than it looks. ffmpeg echoes the URL it was given in
its own diagnostics, so redacting only the plugin's log lines would still leak
the password through stderr. Both paths go through the same function.

## Arguments

Always an array, never a string. A string has to be split somewhere, and a
camera path or password containing a space then runs a different command than
intended. There is no shell involved at any point.

## Resolutions

HomeKit picks from a list the plugin offers, and every entry must be something
the camera can satisfy. The list is filtered against the configured maximum, so
a camera set to 720p is never offered 1080p. Offering one it cannot produce
makes HomeKit ask for a stream that never arrives, and the tile stays black.

If the configured maximum is smaller than every standard size, that maximum is
offered on its own, so a camera is never published with an empty list.
