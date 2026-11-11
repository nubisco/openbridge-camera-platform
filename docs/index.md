---
layout: nubisco
title: 'OpenBridge Camera'
intro: 'Structured configuration, credentials that never reach your logs, and snapshots that give up instead of hanging.'
---

## Where to start

- [Get Started](./installation)
- [Introduction](./introduction)
- [GitHub](https://github.com/nubisco/openbridge-camera-platform)

## OpenBridge Native

Cameras appear as real devices in OpenBridge and as camera accessories in HomeKit, from one pairing.

## Credentials Stay Secret

Username and password are their own fields, redacted from every log line including ffmpeg's own error output.

## Structured Config

Describe the camera, not the ffmpeg command line. Bad configuration is refused at startup with the reason.

## Snapshots That Give Up

Bounded, cached and shared between requests, so an unreachable camera cannot hold a request open for minutes.

## Copy By Default

The camera's H.264 stream is passed through untouched, which is what makes several cameras viable on a Raspberry Pi.

## Honest Resolutions

HomeKit is only offered resolutions the camera is configured to deliver, so a tile never waits for a stream that never comes.
