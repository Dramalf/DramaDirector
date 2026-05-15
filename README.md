# DramaDirector
Node.js video / lottie / audio / text / image composition built on FFmpeg.

DramaDirector takes a declarative description of a video — layers of clips with
timing, positioning and effects — and renders it with FFmpeg. It ships three
ways to drive it, from "agent-friendly shell" all the way down to "build a schema
by hand":

* **`drama` CLI** — one shell command per turn against a JSON session file.
  Perfect for multi-turn agents (Claude Code, scripts, automations) — no Node
  code to author, state lives in the file.
* **`DramaSession`** — the programmatic builder behind the CLI. Add clips one at
  a time, adjust them by id, inspect the composition, persist it across turns,
  then render. Use this when you have a Node process around.
* **`DramaCore` + schema** — the low-level API. You hand it a fully-formed schema
  object. `DramaSession` is a thin layer on top of this.

## 🐾 Quick start

```shell
npm i
npm run build
npm run demo            # renders example/demo.mp4 from a hand-written schema
npm run demo:session    # renders example/session-demo.mp4 via the DramaSession API
npm test                # unit tests + ffmpeg integration renders (mock fixtures)
```

`npm run demo 1` runs the schema demo in stream mode.

For CLI usage in your own project: `npm i dramadirector` and call `npx drama …`
(or `npm link` locally for development).

https://user-images.githubusercontent.com/43701793/229109890-c33b6968-5309-4260-901b-690a781b1ff5.mp4

## 🛠️ `drama` CLI — one shell call per turn

The CLI is the recommended entry point for agents. State lives in a single JSON
file you name; every subcommand reads it, mutates it, writes it back — so a
multi-turn loop is just a sequence of shell commands, no scripts to write.

```shell
# Once: create the session
drama init video.json --width=750 --height=1000

# Each "turn": one shell command
drama add-video video.json --url=intro.mp4 --track=0 --start=0  --end=5  --width=750 --height=-2
drama add-video video.json --url=body.mp4  --track=0 --start=5  --end=14 --width=750 --height=-2
drama add-image video.json --url=logo.png  --track=1 --start=0  --end=14 --x='main_w-90' --y=10 --width=80
drama add-audio video.json --url=bgm.mp3   --track=2 --start=0  --end=14 --seek=4 --volume=+6dB
caption=$(drama add-text video.json --text='Hello' --font=font.ttf --track=3 --start=1 --end=5 --font-color='#00ff75')

# Inspect, adjust, render
drama summary video.json
drama update  video.json "$caption" --end=9
drama remove  video.json video1
drama render  video.json out.mp4
```

`add-*` prints the new clip's id on **stdout** (so you can `$()`-capture it) and
diagnostic messages on **stderr**. `summary` / `list` / `get` / `schema` / `render`
print JSON to stdout; agents and `jq` both parse it cleanly. Invalid input fails
with a clear, located error and a non-zero exit.

Run `drama --help` for the full surface, or read on for the underlying
[`DramaSession`](#-agent-friendly-api-dramasession) it wraps.

## 🤖 Agent-friendly API: `DramaSession`

A session holds a mutable composition. You add **clips**; each clip names a
**track** (its z-order). Clips on the *same* track play back-to-back; higher
track numbers overlay lower ones. Layers, item ids and the FFmpeg filtergraph are
all derived for you.

```javascript
const { DramaSession } = require('dramadirector');

async function run() {
    const session = new DramaSession({ width: 750, height: 1000 });

    // Add clips as upstream tools (video gen, TTS, image gen…) produce files.
    session.addVideo({ url: 'intro.mp4', track: 0, start: 0, end: 5, width: 750, height: -2 });
    session.addVideo({ url: 'body.mp4',  track: 0, start: 5, end: 14, width: 750, height: -2 });
    session.addImage({ url: 'logo.png',  track: 1, start: 0, end: 14, x: 'main_w-90', y: 10, width: 80 });
    session.addAudio({ url: 'bgm.mp3',   track: 2, start: 0, end: 14, seek: 4, volume: '+6dB' });

    const caption = session.addText({
        text: 'Hello',
        fontFile: 'font.ttf',
        track: 3, start: 1, end: 5,
        fontSize: 48, fontColor: '#00ff75',
    });

    // Adjust anything later, addressed by id.
    session.update(caption, { end: 9 });

    // Inspect before rendering.
    console.log(session.summary());

    // Render to a file…
    await session.render('out.mp4');
    // …or stream it: session.stream().pipe(fs.createWriteStream('out.mp4'))
}
run();
```

### Clip kinds

| method        | layer type | required fields                       | notes |
| ------------- | ---------- | ------------------------------------- | ----- |
| `addVideo`    | `normal`   | `url`, `start`, `end`                 | `width`/`height` add a leading `scale` (use `-2` to keep aspect); `hasAudio` keeps the source audio |
| `addImage`    | `normal`   | `url`, `start`, `end`                 | `width`/`height` add a leading `scale` |
| `addAudio`    | `audio`    | `url`, `start`, `end`                 | `volume` adds a leading `volume` effect (e.g. `'+6dB'`) |
| `addText`     | `text`     | `text`, `fontFile`, `start`, `end`    | `fontFile` is required — FFmpeg's `drawtext` needs a `.ttf` |
| `addLottie`   | `lottie`   | `lottie`, `width`, `height`, `start`, `end` | `lottie` is parsed animation JSON |

Common fields on every clip: `track` (default `0`), `start`/`end` (seconds),
`x`/`y`, `effects` (raw FFmpeg filters — see below), and an optional `id`
(auto-generated, e.g. `video1`, when omitted). A track must be homogeneous —
mixing e.g. video and audio clips on one track throws.

### Session methods

| method                       | purpose |
| ----------------------------- | ------- |
| `addVideo/Image/Audio/Text/Lottie(input)` | add a clip, returns its id |
| `update(id, patch)`           | merge a partial change into a clip and re-validate |
| `remove(id)` / `clear()`      | delete one / all clips |
| `get(id)` / `list()` / `has(id)` / `size` | inspect clips |
| `summary()`                   | structured overview (tracks, clips, duration) |
| `toSchema()`                  | build the underlying `DramaSchema` |
| `toJSON()` / `DramaSession.fromJSON(obj)` | serialize / restore — persist a session across agent turns |
| `render(path)`                | render to a file → `{ success, output, duration }` |
| `stream()`                    | render to a fragmented-mp4 stream |
| `toCore()`                    | get the underlying `DramaCore` |

Every `add`/`update` validates eagerly and throws a clear, located error, so a
mistake surfaces at the call site instead of deep inside FFmpeg.

## 🧱 Low-level API: schema + `DramaCore`

A schema is plain data: basic info (`name`, `w`, `h`, `d`) plus `layers`. Each
layer holds one or more `items`. See `example/schema.js` for a complete example.

```javascript
const { DramaCore, validateSchema } = require('dramadirector');
const schema = require('./schema');

validateSchema(schema);              // optional — DramaCore validates internally too
new DramaCore(schema).save('out.mp4');
```

### 💾 Layer
* `index`: id of this layer
* `type`: **normal** / **audio** / **lottie** / **text**
* `items`: items in this layer

### 💿 VideoItem
* `id`: id of this item
* `type`: **video**
* `url`: local path or network link of the resource
* `config`: the basic info of the item

  | attr | type          | usage                                              |
  | ---- | ------------- | -------------------------------------------------- |
  | st   | number/string | the start time of the item in the whole production |
  | et   | number/string | the end time of the item in the whole production   |
  | seek | number/string | from which second the item starts playing          |
  | x    | number/string | position x                                         |
  | y    | number/string | position y                                         |
* `effects`: the effects on the item (filters like scale, blur — follow the rules of fluent-ffmpeg)

  | attr    | type          | usage            |
  | ------- | ------------- | ---------------- |
  | nm      | string        | name of filter   |
  | options | string/object | option of filter |

### 🎇 ImageItem
* `id`: id of this item
* `type`: **image**
* `url`: local path or network link of the resource
* `config`: the basic info of the item
* `effects`: the effects on the item (filters like scale, blur — follow the rules of fluent-ffmpeg)

### 🎊 LottieItem
* `id`: id of this item
* `type`: **lottie**
* `lottie`: the lottie JSON object
* `config`: the basic info of the item

  | attr | type          | usage                                              |
  | ---- | ------------- | -------------------------------------------------- |
  | st   | number/string | the start time of the item in the whole production |
  | et   | number/string | the end time of the item in the whole production   |
  | seek | number/string | from which second the item starts playing          |
  | x    | number/string | position x                                         |
  | y    | number/string | position y                                         |
  | fps  | number/string | frame rate                                         |
  | w    | number/string | width, currently required                          |
  | h    | number/string | height, currently required                         |
* `effects`: 【**TODO**】effects on the item (filters like crop, blur — follow the rules of fluent-ffmpeg)

### 🎼 TextItem
* `id`: id of this item
* `type`: **text**
* `config`: the basic info of the item

  | attr        | type          | usage                                              |
  | ----------- | ------------- | -------------------------------------------------- |
  | st          | number/string | the start time of the item in the whole production |
  | et          | number/string | the end time of the item in the whole production   |
  | text        | string        | text                                               |
  | fontcolor   | string        | color of text                                      |
  | fontsize    | number/string | size of font                                       |
  | bordercolor | string        | color of inner border                              |
  | borderw     | number/string | width of inner border                              |
  | obc         | string        | color of outer border                              |
  | obw         | number/string | width of outer border                             |
  | ttfPath     | string        | local path of a `.ttf` file                        |
* `effects`: effects on the item (filters like scale — follow the rules of fluent-ffmpeg)

### 🎼 AudioItem
* `id`: id of this item
* `type`: **audio**
* `url`: local path or network link of the resource
* `config`: the basic info of the item

  | attr | type          | usage                                              |
  | ---- | ------------- | -------------------------------------------------- |
  | st   | number/string | the start time of the item in the whole production |
  | et   | number/string | the end time of the item in the whole production   |
  | seek | number/string | from which second the item starts playing          |
* `effects`: effects on the item (filters like volume — follow the rules of fluent-ffmpeg)

By using ffmpeg-utils in `effects`, you can even achieve keyframe animation.

## Consume the schema
`npm i dramadirector`

```javascript
const DramaCore = require('dramadirector').default;
// The schema describes how the production is organized.
const dramaSchema = require('./schema');
const path = require('path');
const fs = require('fs');
const [, , useStream] = process.argv;

async function run() {
    const saveFilePath = path.join(__dirname, 'demo.mp4');
    const director = new DramaCore(dramaSchema);
    console.time('task');
    if (useStream) {
        const stream = director.getStream();
        const outputStream = fs.createWriteStream(saveFilePath);
        stream.pipe(outputStream);
        outputStream.on('finish', () => {
            console.timeEnd('task');
        });
    } else {
        director.save(saveFilePath).then(() => {
            console.timeEnd('task');
        }).catch(err => {
            console.log(err);
        });
    }
}
run();
```
