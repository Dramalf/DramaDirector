/**
 * `drama` CLI — every subcommand reads and writes a single JSON session file,
 * so state lives in that file rather than in this process. That makes the tool
 * a natural fit for multi-turn agent loops: one shell call per turn, no scripts
 * to author, no in-memory session to keep alive.
 *
 *   drama init    session.json --width=750 --height=1000
 *   drama add-video session.json --url=intro.mp4 --start=0 --end=5 --track=0
 *   drama summary session.json
 *   drama update  session.json text1 --end=9
 *   drama render  session.json out.mp4
 */
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import DramaSession, { ClipKind } from '../Session';

// Every option the CLI ever accepts, declared once. parseArgs is strict, so an
// unknown flag fails loudly — but a known flag passed to a command that
// doesn't use it (e.g. `init --url=...`) is silently ignored.
const OPTS = {
    // session
    width: { type: 'string' as const },
    height: { type: 'string' as const },
    duration: { type: 'string' as const },
    name: { type: 'string' as const },
    // clip core
    url: { type: 'string' as const },
    track: { type: 'string' as const },
    start: { type: 'string' as const },
    end: { type: 'string' as const },
    seek: { type: 'string' as const },
    x: { type: 'string' as const },
    y: { type: 'string' as const },
    id: { type: 'string' as const },
    effects: { type: 'string' as const },
    // video/image
    'has-audio': { type: 'boolean' as const },
    // audio
    volume: { type: 'string' as const },
    // text
    text: { type: 'string' as const },
    font: { type: 'string' as const },
    'font-size': { type: 'string' as const },
    'font-color': { type: 'string' as const },
    'border-color': { type: 'string' as const },
    'border-width': { type: 'string' as const },
    'outer-border-color': { type: 'string' as const },
    'outer-border-width': { type: 'string' as const },
    'line-spacing': { type: 'string' as const },
    // lottie
    lottie: { type: 'string' as const },
    fps: { type: 'string' as const },
    // help
    help: { type: 'boolean' as const, short: 'h' as const },
};

const USAGE = `drama — DramaDirector CLI for incremental video composition.

A session lives in one JSON file; every command reads it, mutates it, writes it
back. Run "drama init" once, then add/update/remove/render across many turns.

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

  drama get     <file> <id>          # prints the clip as JSON
  drama list    <file>               # prints all clips as JSON
  drama summary <file>               # prints a structured overview as JSON
  drama schema  <file>               # prints the derived DramaSchema as JSON

  drama render  <file> <out.mp4>     # renders the composition

Notes:
  - Use --key=value (not --key value) to keep negative numbers and ffmpeg
    expressions intact, e.g. --height=-2, --x='(w-text_w)/2'.
  - Position fields (x/y) parse as numbers when possible, else passthrough
    as ffmpeg expressions.
  - Auto-generated ids look like video1, text2, etc.; pass --id=NAME to
    name a clip yourself so a later turn can address it semantically.
`;

// ---------- entry point ------------------------------------------------------

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
        process.stdout.write(USAGE);
        return 0;
    }
    const [cmd, ...rest] = argv;
    try {
        return await dispatch(cmd, rest);
    } catch (e: any) {
        process.stderr.write(`drama: ${e && e.message ? e.message : e}\n`);
        return 1;
    }
}

async function dispatch(cmd: string, args: string[]): Promise<number> {
    switch (cmd) {
        case 'init':       return cmdInit(args);
        case 'add-video':  return cmdAdd('video',  args);
        case 'add-image':  return cmdAdd('image',  args);
        case 'add-audio':  return cmdAdd('audio',  args);
        case 'add-text':   return cmdAdd('text',   args);
        case 'add-lottie': return cmdAdd('lottie', args);
        case 'update':     return cmdUpdate(args);
        case 'remove':     return cmdRemove(args);
        case 'clear':      return cmdClear(args);
        case 'get':        return cmdGet(args);
        case 'list':       return cmdList(args);
        case 'summary':    return cmdSummary(args);
        case 'schema':     return cmdSchema(args);
        case 'render':     return cmdRender(args);
        default:
            throw new Error(`unknown command "${cmd}". Run "drama --help".`);
    }
}

// ---------- session I/O ------------------------------------------------------

function loadSession(file: string | undefined, cmdName: string): { session: DramaSession; abs: string } {
    if (!file) {
        throw new Error(`${cmdName}: missing session file. Usage: drama ${cmdName} <file> ...`);
    }
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
        throw new Error(`${cmdName}: session file not found: ${abs}. Run "drama init" first.`);
    }
    let data: any;
    try {
        data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (e: any) {
        throw new Error(`${cmdName}: ${abs} is not valid JSON: ${e.message}`);
    }
    return { session: DramaSession.fromJSON(data), abs };
}

function saveSession(session: DramaSession, abs: string): void {
    fs.writeFileSync(abs, JSON.stringify(session.toJSON(), null, 2) + '\n');
}

// ---------- coercion helpers -------------------------------------------------

function num(name: string, v: string | undefined): number | undefined {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!isFinite(n)) throw new Error(`--${name} must be a number, got "${v}".`);
    return n;
}
function int(name: string, v: string | undefined): number | undefined {
    const n = num(name, v);
    if (n === undefined) return undefined;
    if (!Number.isInteger(n)) throw new Error(`--${name} must be an integer, got "${v}".`);
    return n;
}
/** Position fields — number if numeric, otherwise pass through as ffmpeg expression. */
function pos(v: string | undefined): number | string | undefined {
    if (v === undefined) return undefined;
    const n = Number(v);
    return isFinite(n) ? n : v;
}
/** A field that prefers numbers but accepts string expressions (font-size, volume). */
function numOrStr(v: string | undefined): number | string | undefined {
    return pos(v);
}
function require_<T>(name: string, v: T | undefined, cmdName: string): T {
    if (v === undefined) throw new Error(`${cmdName}: --${name} is required.`);
    return v;
}
function parseJSON(name: string, v: string): any {
    try { return JSON.parse(v); }
    catch (e: any) { throw new Error(`--${name} must be valid JSON: ${e.message}`); }
}
function loadJSONFile(name: string, file: string): any {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) throw new Error(`--${name} file not found: ${abs}`);
    try { return JSON.parse(fs.readFileSync(abs, 'utf8')); }
    catch (e: any) { throw new Error(`--${name}: ${abs} is not valid JSON: ${e.message}`); }
}

// ---------- commands ---------------------------------------------------------

function cmdInit(args: string[]): number {
    const { values, positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    if (!file) throw new Error('init: missing session file. Usage: drama init <file> --width=W --height=H');
    const abs = path.resolve(file);
    if (fs.existsSync(abs)) throw new Error(`init: ${abs} already exists.`);
    const session = new DramaSession({
        width: require_('width', num('width', values.width), 'init'),
        height: require_('height', num('height', values.height), 'init'),
        duration: num('duration', values.duration),
        name: values.name,
    });
    saveSession(session, abs);
    process.stderr.write(`created ${abs}\n`);
    return 0;
}

function cmdAdd(kind: ClipKind, args: string[]): number {
    const { values, positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    const cmdName = `add-${kind}`;
    const { session, abs } = loadSession(file, cmdName);
    const input = buildInput(kind, values, cmdName);
    const method = `add${kind[0].toUpperCase()}${kind.slice(1)}` as
        'addVideo' | 'addImage' | 'addAudio' | 'addText' | 'addLottie';
    const id = (session[method] as (i: any) => string)(input);
    saveSession(session, abs);
    process.stdout.write(id + '\n');
    return 0;
}

function cmdUpdate(args: string[]): number {
    const { values, positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file, id] = positionals;
    if (!id) throw new Error('update: usage: drama update <file> <id> [--option=value ...]');
    const { session, abs } = loadSession(file, 'update');
    const existing = session.get(id);
    if (!existing) throw new Error(`update: no clip with id "${id}".`);
    const patch = buildPatch(existing.kind, values);
    if (Object.keys(patch).length === 0) {
        throw new Error('update: nothing to update — pass at least one --option=value.');
    }
    session.update(id, patch);
    saveSession(session, abs);
    process.stderr.write(`updated ${id}\n`);
    return 0;
}

function cmdRemove(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file, id] = positionals;
    if (!id) throw new Error('remove: usage: drama remove <file> <id>');
    const { session, abs } = loadSession(file, 'remove');
    if (!session.remove(id)) throw new Error(`remove: no clip with id "${id}".`);
    saveSession(session, abs);
    process.stderr.write(`removed ${id}\n`);
    return 0;
}

function cmdClear(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    const { session, abs } = loadSession(file, 'clear');
    session.clear();
    saveSession(session, abs);
    process.stderr.write('cleared\n');
    return 0;
}

function cmdGet(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file, id] = positionals;
    if (!id) throw new Error('get: usage: drama get <file> <id>');
    const { session } = loadSession(file, 'get');
    const clip = session.get(id);
    if (!clip) throw new Error(`get: no clip with id "${id}".`);
    process.stdout.write(JSON.stringify(clip, null, 2) + '\n');
    return 0;
}

function cmdList(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    const { session } = loadSession(file, 'list');
    process.stdout.write(JSON.stringify(session.list(), null, 2) + '\n');
    return 0;
}

function cmdSummary(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    const { session } = loadSession(file, 'summary');
    process.stdout.write(JSON.stringify(session.summary(), null, 2) + '\n');
    return 0;
}

function cmdSchema(args: string[]): number {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file] = positionals;
    const { session } = loadSession(file, 'schema');
    process.stdout.write(JSON.stringify(session.toSchema(), null, 2) + '\n');
    return 0;
}

async function cmdRender(args: string[]): Promise<number> {
    const { positionals } = parseArgs({ args, options: OPTS, allowPositionals: true });
    const [file, out] = positionals;
    if (!out) throw new Error('render: usage: drama render <file> <out.mp4>');
    const { session } = loadSession(file, 'render');
    const result = await session.render(path.resolve(out));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
}

// ---------- option -> clip input mapping -------------------------------------

function buildInput(kind: ClipKind, v: any, cmdName: string): any {
    const input: any = {
        start: require_('start', num('start', v.start), cmdName),
        end: require_('end', num('end', v.end), cmdName),
    };
    if (v.track !== undefined) input.track = int('track', v.track);
    if (v.id !== undefined) input.id = v.id;
    if (v.effects !== undefined) input.effects = parseJSON('effects', v.effects);

    switch (kind) {
        case 'video':
            input.url = require_('url', v.url, cmdName);
            if (v.seek !== undefined) input.seek = num('seek', v.seek);
            if (v.x !== undefined) input.x = pos(v.x);
            if (v.y !== undefined) input.y = pos(v.y);
            if (v.width !== undefined) input.width = num('width', v.width);
            if (v.height !== undefined) input.height = num('height', v.height);
            if (v['has-audio']) input.hasAudio = true;
            break;
        case 'image':
            input.url = require_('url', v.url, cmdName);
            if (v.seek !== undefined) input.seek = num('seek', v.seek);
            if (v.x !== undefined) input.x = pos(v.x);
            if (v.y !== undefined) input.y = pos(v.y);
            if (v.width !== undefined) input.width = num('width', v.width);
            if (v.height !== undefined) input.height = num('height', v.height);
            break;
        case 'audio':
            input.url = require_('url', v.url, cmdName);
            if (v.seek !== undefined) input.seek = num('seek', v.seek);
            if (v.volume !== undefined) input.volume = numOrStr(v.volume);
            break;
        case 'text':
            input.text = require_('text', v.text, cmdName);
            input.fontFile = require_('font', v.font, cmdName);
            if (v.x !== undefined) input.x = pos(v.x);
            if (v.y !== undefined) input.y = pos(v.y);
            if (v['font-size'] !== undefined) input.fontSize = numOrStr(v['font-size']);
            if (v['font-color'] !== undefined) input.fontColor = v['font-color'];
            if (v['border-color'] !== undefined) input.borderColor = v['border-color'];
            if (v['border-width'] !== undefined) input.borderWidth = num('border-width', v['border-width']);
            if (v['outer-border-color'] !== undefined) input.outerBorderColor = v['outer-border-color'];
            if (v['outer-border-width'] !== undefined) input.outerBorderWidth = num('outer-border-width', v['outer-border-width']);
            if (v['line-spacing'] !== undefined) input.lineSpacing = num('line-spacing', v['line-spacing']);
            break;
        case 'lottie':
            input.lottie = loadJSONFile('lottie', require_('lottie', v.lottie, cmdName));
            input.width = require_('width', num('width', v.width), cmdName);
            input.height = require_('height', num('height', v.height), cmdName);
            if (v.fps !== undefined) input.fps = num('fps', v.fps);
            if (v.seek !== undefined) input.seek = num('seek', v.seek);
            if (v.x !== undefined) input.x = pos(v.x);
            if (v.y !== undefined) input.y = pos(v.y);
            break;
    }
    return input;
}

function buildPatch(kind: ClipKind, v: any): any {
    const p: any = {};
    if (v.start !== undefined) p.start = num('start', v.start);
    if (v.end !== undefined) p.end = num('end', v.end);
    if (v.track !== undefined) p.track = int('track', v.track);
    if (v.url !== undefined) p.url = v.url;
    if (v.seek !== undefined) p.seek = num('seek', v.seek);
    if (v.x !== undefined) p.x = pos(v.x);
    if (v.y !== undefined) p.y = pos(v.y);
    if (v.width !== undefined) {
        // For lottie, width/height are numeric size; for video/image they're a scale convenience.
        p.width = num('width', v.width);
    }
    if (v.height !== undefined) p.height = num('height', v.height);
    if (v['has-audio']) p.hasAudio = true;
    if (v.volume !== undefined) p.volume = numOrStr(v.volume);
    if (v.text !== undefined) p.text = v.text;
    if (v.font !== undefined) p.fontFile = v.font;
    if (v['font-size'] !== undefined) p.fontSize = numOrStr(v['font-size']);
    if (v['font-color'] !== undefined) p.fontColor = v['font-color'];
    if (v['border-color'] !== undefined) p.borderColor = v['border-color'];
    if (v['border-width'] !== undefined) p.borderWidth = num('border-width', v['border-width']);
    if (v['outer-border-color'] !== undefined) p.outerBorderColor = v['outer-border-color'];
    if (v['outer-border-width'] !== undefined) p.outerBorderWidth = num('outer-border-width', v['outer-border-width']);
    if (v['line-spacing'] !== undefined) p.lineSpacing = num('line-spacing', v['line-spacing']);
    if (v.fps !== undefined) p.fps = num('fps', v.fps);
    if (v.lottie !== undefined) p.lottie = loadJSONFile('lottie', v.lottie);
    if (v.effects !== undefined) p.effects = parseJSON('effects', v.effects);
    return p;
}

// Standalone usage: `node dist/cli/index.js …` (the published bin wrapper
// imports `main` instead).
if (require.main === module) {
    main().then((c) => process.exit(c));
}
