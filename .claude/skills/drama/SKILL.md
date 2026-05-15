---
name: drama
description: Compose, edit and render videos via the `drama` CLI (from npm package `dramadirector`). Build a JSON-backed session of clips (video/image/audio/text/lottie) on tracks, add/update/remove clips across turns, then render to mp4. Use when assembling or editing multi-clip videos from existing or generated asset files — especially in iterative multi-turn flows ("add this", "make it longer", "swap that", "render it"). Do not use for generating the underlying clips themselves (video gen, TTS, image gen), or for one-off raw ffmpeg invocations.
---

# drama — multi-turn video composition

`drama` is a CLI that assembles a video from clip files that already exist on
disk. State lives in a JSON session file you name; every turn is one shell
command against that file.

You are **not** generating clips with this tool. You are arranging clips that
exist (or that another tool produced this turn).

## When to use

Use when the user wants to:
- assemble a video from multiple clip files (video / image / audio / text / lottie)
- iteratively edit a composition ("change", "extend", "swap", "remove", "render")
- combine overlays, sequenced cuts, background audio and captions

Do not use when:
- the user needs the *content* of a clip generated (a video, TTS line, image) — pick the appropriate generator tool first, then drama
- a single bespoke ffmpeg invocation is all that's needed
- the request isn't about video composition

## Prerequisites

`dramadirector` provides the `drama` binary. Install it in the target project:

```bash
npm i dramadirector
npx drama --help          # confirm
```

If installed globally (`npm i -g dramadirector`) just call `drama …` directly.
Renders require ffmpeg — bundled via `@ffmpeg-installer/ffmpeg`, no separate
install needed.

## Mental model

- A **session** is a single JSON file (e.g. `video.json`). The file *is* the
  state. Different sessions = different files. Branch a draft with `cp`.
- A session contains **clips**. Each clip names a **track** (z-order, integer).
- Clips on the **same track** play back-to-back (concatenated), sorted by start.
- Clips on **different tracks** overlay; higher track number = on top.
- One track = one layer type. Mixing kinds on a track fails:
  - `video` + `image` → layer type `normal`
  - `audio`            → layer type `audio`
  - `text`             → layer type `text`
  - `lottie`           → layer type `lottie`
- Times are **seconds**. `--start` / `--end` are absolute composition times,
  not duration.

## Standard workflow

```bash
# 1. Create the session once
drama init video.json --width=1080 --height=1920

# 2. Add clips (one shell command each) as upstream tools produce files
drama add-video video.json --url=intro.mp4 --track=0 --start=0 --end=5 --width=1080 --height=-2
drama add-audio video.json --url=bgm.mp3   --track=20 --start=0 --end=20 --volume=-6dB
caption=$(drama add-text video.json \
  --text='Hello' --font=fonts/Inter.ttf \
  --track=10 --start=1 --end=5 \
  --font-size=64 --font-color='#fff')

# 3. Inspect before non-trivial edits or render
drama summary video.json

# 4. Edit by id (auto: video1, text1, …  or whatever you passed via --id=)
drama update video.json "$caption" --end=9
drama remove video.json video1

# 5. Render
drama render video.json out.mp4
```

Output conventions (matters for scripting):
- `add-*` prints **the new clip id to stdout** — capture with `$(…)`.
- `init` / `update` / `remove` / `clear` print status to **stderr**.
- `summary` / `list` / `get` / `schema` / `render` print **JSON to stdout** —
  pipe to `jq` or `JSON.parse`.
- Errors go to **stderr**, exit code is non-zero. The first line of stderr
  always identifies which option/clip is at fault.

## Command reference

```
drama init <file> --width=W --height=H [--duration=D] [--name=N]

drama add-video  <file> --url=PATH --start=N --end=N
                        [--track=N] [--seek=N] [--x=N] [--y=N]
                        [--width=N] [--height=N] [--has-audio]
                        [--id=ID] [--effects='[{...}]']
drama add-image  <file> --url=PATH --start=N --end=N
                        [--track=N] [--x=N] [--y=N]
                        [--width=N] [--height=N] [--id=ID]
drama add-audio  <file> --url=PATH --start=N --end=N
                        [--track=N] [--seek=N] [--volume=V] [--id=ID]
drama add-text   <file> --text=STR --font=PATH.ttf --start=N --end=N
                        [--track=N] [--x=N] [--y=N]
                        [--font-size=N] [--font-color=#hex]
                        [--border-color=#hex] [--border-width=N]
                        [--outer-border-color=#hex] [--outer-border-width=N]
                        [--line-spacing=N] [--id=ID]
drama add-lottie <file> --lottie=PATH.json --start=N --end=N
                        --width=N --height=N
                        [--track=N] [--fps=N] [--seek=N]
                        [--x=N] [--y=N] [--id=ID]

drama update  <file> <id> [--<any-add-option>=...]
drama remove  <file> <id>
drama clear   <file>

drama get     <file> <id>             # JSON for one clip
drama list    <file>                  # JSON for all clips, insertion order
drama summary <file>                  # JSON: tracks, clips, computed duration
drama schema  <file>                  # JSON: the derived DramaSchema (debug)

drama render  <file> <out.mp4>        # JSON: { success, output, duration }
```

**Always use `--key=value`, not `--key value`.** `--height=-2` and
`--x='(w-text_w)/2'` get mangled otherwise.

## Recipes

### Sequential clips (cut-to-cut on one track)
```bash
drama add-video v.json --url=intro.mp4 --track=0 --start=0 --end=5
drama add-video v.json --url=body.mp4  --track=0 --start=5 --end=20
```

### Logo overlay above everything
```bash
drama add-image v.json --url=logo.png --track=99 \
  --start=0 --end=20 --x='main_w-90' --y=10 --width=80
```

### Centered caption with stroke
```bash
drama add-text v.json --text='标题' --font=fonts/SmileySans.ttf \
  --track=10 --start=1 --end=5 \
  --x='(w-text_w)/2' --y='h*5/6' \
  --font-size=64 --font-color='#fff' \
  --border-color='#000' --border-width=3
```

### Background music + voiceover (two audio tracks auto-mix)
```bash
drama add-audio v.json --url=bgm.mp3        --track=20 --start=0 --end=20 --volume=-6dB
drama add-audio v.json --url=narration.wav  --track=21 --start=1 --end=8  --volume=+3dB
```

### Trim a long source via `--seek`
```bash
drama add-video v.json --url=long.mp4 --track=0 --start=0 --end=10 --seek=30
# uses seconds 30-40 of long.mp4, placed at composition seconds 0-10
```

### Scale while keeping aspect ratio
```bash
drama add-video v.json --url=raw.mp4 --track=0 --start=0 --end=5 \
  --width=1080 --height=-2          # -2 = "auto, keep aspect"
```

### "Extend by N seconds" (read-modify-update)
There's no relative `extend` — read the current `end` and add:
```bash
end=$(drama get v.json title | jq -r .end)
drama update v.json title --end="$(echo "$end + 2" | bc)"
```

### Replace the source of an existing clip
```bash
drama update v.json hero --url=new_take.mp4
```

### Raw ffmpeg filters via `--effects`
```bash
drama add-video v.json --url=in.mp4 --track=0 --start=0 --end=5 \
  --effects='[{"nm":"boxblur","options":"10"},{"nm":"hue","options":"h=60"}]'
```

## Identifying clips across turns

Auto-ids are `video1`, `image2`, `text1`, etc. For multi-turn flows where the
user refers to clips by role, **pass `--id=NAME` on add** so later turns can
address them semantically:

```bash
drama add-video v.json --id=hero  --url=intro.mp4 ...
drama add-text  v.json --id=title --text='...'    ...
# next turn:
drama update v.json hero  --end=8
drama update v.json title --font-color='#f00'
```

If a session already has auto-ids, recover layout with `drama summary` or
`drama list` before editing.

## Inspecting state

Run this whenever you're unsure what's in the session:

```bash
drama summary v.json    # tracks, clips, computed duration
drama list    v.json    # full clip records, insertion order
drama get     v.json hero
```

`summary` output shape:
```json
{
  "width": 1080,
  "height": 1920,
  "duration": 20,
  "clipCount": 4,
  "tracks": [
    { "track": 0,  "layerType": "normal", "clips": [{"id":"hero","kind":"video","start":0,"end":5}] },
    { "track": 20, "layerType": "audio",  "clips": [{"id":"bgm","kind":"audio","start":0,"end":20}] }
  ]
}
```

`schema` returns the lower-level `DramaSchema` the renderer actually consumes —
useful when a render fails and you want to see the filtergraph inputs.

## Gotchas

- **One track, one layer type.** Putting video and audio on the same `--track=N`
  fails at render with "mixes incompatible clip kinds". Use different tracks.
- **Text needs a font.** `--font=PATH.ttf` is required — ffmpeg's `drawtext`
  does not pick up system fonts.
- **Source files only checked at render time.** `add-*` validates shape, not
  existence. If a render fails with "No such file", verify the `--url=` paths.
- **Numbers vs ffmpeg expressions.** `--x=100` is numeric; `--x='(w-text_w)/2'`
  is an ffmpeg expression — quote it and use `=` form.
- **`--height=-2`** means "auto, keep aspect ratio" — common idiom for scaling.
- **Audio is auto-mixed** across tracks via `amix`; balance with per-clip
  `--volume=`.
- **Renders can be slow.** Expect a few seconds per second of composition for
  typical 1080p input; longer for complex filter chains.
- **`--end` is composition time, not duration.** A clip that "plays for 5s
  starting at t=10" has `--start=10 --end=15`.

## Failure debugging

1. Check stderr — the CLI surfaces a single clear sentence pointing at the
   bad option or clip.
2. Run `drama summary <file>` — confirms layout is what you expected.
3. Run `drama schema <file>` — shows the raw schema the engine will render;
   fastest way to spot wrong track types, missing fields, or duration issues.
4. For ffmpeg-level failures (rare), the ffmpeg stderr is forwarded; look for
   "Error initializing complex filters" (typing/filtergraph) or "No such file".
