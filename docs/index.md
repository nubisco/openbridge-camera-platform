---
layout: home

hero:
  name: OpenBridge Camera
  text: RTSP Cameras in HomeKit
  tagline: Structured configuration, credentials that never reach your logs, and snapshots that give up instead of hanging.
  actions:
    - theme: brand
      text: Get Started
      link: ./installation
    - theme: alt
      text: Introduction
      link: ./introduction
    - theme: alt
      text: GitHub
      link: https://github.com/nubisco/openbridge-camera-platform
  image:
    src: /logo.svg
    alt: OpenBridge Camera Platform

features:
  - icon:
      src: /openbridge.svg
    title: OpenBridge Native
    details: Cameras appear as real devices in OpenBridge and as camera accessories in HomeKit, from one pairing.
  - icon:
      src: /privacy.svg
    title: Credentials Stay Secret
    details: Username and password are their own fields, redacted from every log line including ffmpeg's own error output.
  - icon:
      src: /protocol.svg
    title: Structured Config
    details: Describe the camera, not the ffmpeg command line. Bad configuration is refused at startup with the reason.
  - icon:
      src: /handshake.svg
    title: Snapshots That Give Up
    details: Bounded, cached and shared between requests, so an unreachable camera cannot hold a request open for minutes.
  - icon:
      src: /lightning.svg
    title: Copy By Default
    details: The camera's H.264 stream is passed through untouched, which is what makes several cameras viable on a Raspberry Pi.
  - icon:
      src: /device.svg
    title: Honest Resolutions
    details: HomeKit is only offered resolutions the camera is configured to deliver, so a tile never waits for a stream that never comes.
---
