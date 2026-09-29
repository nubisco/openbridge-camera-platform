# Contributing

```sh
git clone https://github.com/nubisco/openbridge-camera-platform
cd openbridge-camera-platform
npm install
npm run quality:check
```

## Testing

The unit tests cover the parts that carry real risk and need no hardware:
credential handling and redaction, argument construction, config validation, and
the snapshot cache and timeout.

For a real camera, build and drive the pieces directly:

```sh
npm run build
node -e "
  const { snapshotArgs, describeCommand } = require('./dist/ffmpeg/args.js')
  const camera = { name: 'Test', url: 'rtsp://10.0.0.5:554/stream1', username: 'u', password: 'p',
                   transport: 'tcp', maxWidth: 1280, maxHeight: 720 }
  console.log(describeCommand('ffmpeg', snapshotArgs(camera)))
"
```

## What to be careful about

**Never let a credential reach a log.** Everything printed goes through
`redact()`, including ffmpeg's stderr. A new log line that formats a URL itself
is a leak.

**Never build a command as a string.** Arguments are arrays. A string has to be
split somewhere and a space in a path or password becomes a different command.

**Never let a request wait indefinitely.** Anything touching a camera needs a
timeout. An unreachable camera does not fail fast, it fails slowly, and that is
what makes a bridge feel broken.

**Prefer copying to re-encoding.** Re-encoding is the expensive path and should
stay opt-in.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/). Releases are cut
by semantic-release from the history.
