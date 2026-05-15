/**
 * DramaSession — an incremental, agent-friendly composition builder.
 *
 * The raw `DramaSchema` is great for a hand-written config, but awkward for a
 * program (or an LLM agent) that builds a video step by step: it has to track
 * layer indices, item ids, and filtergraph-shaped config by hand, and there is
 * no way to inspect or tweak the composition without rebuilding the whole tree.
 *
 * `DramaSession` is a thin, stateful layer over `DramaCore`:
 *   - add clips one at a time with friendly names (`start`/`end`, `width`/`height`...)
 *   - `update` / `remove` / `get` / `list` to adjust an in-progress composition
 *   - `summary()` for introspection
 *   - `toJSON()` / `fromJSON()` to persist a session across agent turns
 *   - `render()` / `stream()` to produce the video
 *
 * Layers are derived automatically: every clip names a `track` (z-order); the
 * session groups clips by track, picks the matching layer type, and sorts each
 * track chronologically. Higher track numbers overlay lower ones.
 */
import DramaCore from "../Core";
import { validateSchema } from "../Utils/validate";

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'lottie';

/** A raw fluent-ffmpeg filter, e.g. `{ nm: 'boxblur', options: '20' }`. */
export interface DramaEffect {
    nm: string;
    options?: any;
}

/** Maps a clip kind to the schema layer type that can hold it. */
const KIND_TO_LAYER_TYPE: { [k in ClipKind]: string } = {
    video: 'normal',
    image: 'normal',
    audio: 'audio',
    text: 'text',
    lottie: 'lottie',
};

export interface SessionOptions {
    width: number;
    height: number;
    /** Output duration in seconds. Defaults to the latest clip end. */
    duration?: number;
    name?: string;
}

interface CommonClipInput {
    /** Optional explicit id; auto-generated (e.g. `video1`) when omitted. */
    id?: string;
    /** Track / z-order. Same track = clips play back-to-back; higher track overlays. Default 0. */
    track?: number;
    /** Start time in the composition, seconds. */
    start: number;
    /** End time in the composition, seconds. */
    end: number;
    /** Extra raw ffmpeg filters applied after the convenience ones. */
    effects?: DramaEffect[];
}

export interface VideoClipInput extends CommonClipInput {
    url: string;
    /** Seconds into the source file to start playing from. */
    seek?: number;
    x?: number | string;
    y?: number | string;
    /** Convenience: adds a leading `scale` effect. Use -2 to keep aspect ratio. */
    width?: number;
    height?: number;
    /** Keep the source audio track (off by default). */
    hasAudio?: boolean;
}

export interface ImageClipInput extends CommonClipInput {
    url: string;
    seek?: number;
    x?: number | string;
    y?: number | string;
    /** Convenience: adds a leading `scale` effect. Use -2 to keep aspect ratio. */
    width?: number;
    height?: number;
}

export interface AudioClipInput extends CommonClipInput {
    url: string;
    seek?: number;
    /** Convenience: adds a leading `volume` effect, e.g. `'+6dB'` or `2`. */
    volume?: number | string;
}

export interface TextClipInput extends CommonClipInput {
    text: string;
    /** Path to a `.ttf` font file (required — ffmpeg's drawtext needs one). */
    fontFile: string;
    x?: number | string;
    y?: number | string;
    fontSize?: number | string;
    fontColor?: string;
    borderColor?: string;
    borderWidth?: number;
    outerBorderColor?: string;
    outerBorderWidth?: number;
    lineSpacing?: number;
}

export interface LottieClipInput extends CommonClipInput {
    /** Parsed Lottie animation JSON. */
    lottie: any;
    /** Render size — required by the Lottie rasterizer. */
    width: number;
    height: number;
    fps?: number;
    seek?: number;
    x?: number | string;
    y?: number | string;
}

export type ClipInput =
    | VideoClipInput
    | ImageClipInput
    | AudioClipInput
    | TextClipInput
    | LottieClipInput;

interface StoredClip {
    id: string;
    kind: ClipKind;
    /** The friendly input as given by the caller, minus `id`. */
    input: any;
}

const isFiniteNumber = (v: any): v is number => typeof v === 'number' && isFinite(v);

export default class DramaSession {
    private opts: SessionOptions;
    private clips: Map<string, StoredClip> = new Map();
    /** Insertion order, so list()/toJSON() are stable. */
    private order: string[] = [];
    private counter = 0;

    constructor(opts: SessionOptions) {
        if (!opts || typeof opts !== 'object') {
            throw new Error('DramaSession: constructor requires a { width, height } options object.');
        }
        if (!isFiniteNumber(opts.width) || opts.width <= 0) {
            throw new Error(`DramaSession: "width" must be a positive number (got ${JSON.stringify(opts.width)}).`);
        }
        if (!isFiniteNumber(opts.height) || opts.height <= 0) {
            throw new Error(`DramaSession: "height" must be a positive number (got ${JSON.stringify(opts.height)}).`);
        }
        if (opts.duration != null && (!isFiniteNumber(opts.duration) || opts.duration < 0)) {
            throw new Error(`DramaSession: "duration" must be a non-negative number when provided (got ${JSON.stringify(opts.duration)}).`);
        }
        this.opts = {
            width: opts.width,
            height: opts.height,
            duration: opts.duration,
            name: opts.name,
        };
    }

    // ----- adding clips -------------------------------------------------------

    /** Add a video clip. Returns the clip id. */
    addVideo(input: VideoClipInput): string {
        return this._add('video', input);
    }
    /** Add a still image clip. Returns the clip id. */
    addImage(input: ImageClipInput): string {
        return this._add('image', input);
    }
    /** Add an audio clip. Returns the clip id. */
    addAudio(input: AudioClipInput): string {
        return this._add('audio', input);
    }
    /** Add a text overlay. Returns the clip id. */
    addText(input: TextClipInput): string {
        return this._add('text', input);
    }
    /** Add a Lottie animation clip. Returns the clip id. */
    addLottie(input: LottieClipInput): string {
        return this._add('lottie', input);
    }

    // ----- editing clips ------------------------------------------------------

    /** Merge `patch` into an existing clip's input and re-validate. */
    update(id: string, patch: Partial<ClipInput>): void {
        const clip = this.clips.get(id);
        if (!clip) {
            throw new Error(`DramaSession: no clip with id "${id}".`);
        }
        if (patch && ('id' in patch || 'kind' in (patch as any))) {
            throw new Error('DramaSession: "id" and "kind" cannot be changed via update(); remove and re-add instead.');
        }
        const merged = { ...clip.input, ...patch };
        this._validateInput(clip.kind, merged, `clip "${id}"`);
        clip.input = merged;
    }

    /** Remove a clip. Returns true if it existed. */
    remove(id: string): boolean {
        if (!this.clips.has(id)) return false;
        this.clips.delete(id);
        this.order = this.order.filter((x) => x !== id);
        return true;
    }

    /** Remove every clip; keeps the canvas options. */
    clear(): void {
        this.clips.clear();
        this.order = [];
    }

    // ----- inspecting ---------------------------------------------------------

    has(id: string): boolean {
        return this.clips.has(id);
    }

    /** Get a copy of a clip's full input (`{ id, kind, ...input }`), or null. */
    get(id: string): ({ id: string; kind: ClipKind } & Record<string, any>) | null {
        const clip = this.clips.get(id);
        if (!clip) return null;
        return { id: clip.id, kind: clip.kind, ...clip.input };
    }

    /** All clips in insertion order. */
    list(): Array<{ id: string; kind: ClipKind } & Record<string, any>> {
        return this.order.map((id) => this.get(id)!);
    }

    get size(): number {
        return this.clips.size;
    }

    /**
     * A structured overview of the composition — handy for an agent to read
     * back the current state before deciding what to change next.
     */
    summary() {
        const grouped = this._groupByTrack();
        let duration = 0;
        const tracks = [...grouped.keys()].sort((a, b) => a - b).map((track) => {
            const clips = grouped.get(track)!;
            const kinds = [...new Set(clips.map((c) => c.kind))];
            for (const c of clips) duration = Math.max(duration, c.input.end);
            return {
                track,
                layerType: kinds.length === 1 ? KIND_TO_LAYER_TYPE[clips[0].kind] : 'mixed (invalid)',
                clips: clips.map((c) => ({
                    id: c.id,
                    kind: c.kind,
                    start: c.input.start,
                    end: c.input.end,
                })),
            };
        });
        return {
            width: this.opts.width,
            height: this.opts.height,
            duration: this.opts.duration ?? duration,
            clipCount: this.clips.size,
            tracks,
        };
    }

    // ----- persistence --------------------------------------------------------

    /** Serialize the whole session to a plain object (safe to JSON.stringify). */
    toJSON() {
        return {
            width: this.opts.width,
            height: this.opts.height,
            duration: this.opts.duration,
            name: this.opts.name,
            clips: this.order.map((id) => {
                const c = this.clips.get(id)!;
                return { id: c.id, kind: c.kind, ...c.input };
            }),
        };
    }

    /** Rebuild a session from `toJSON()` output — e.g. across agent turns. */
    static fromJSON(obj: any): DramaSession {
        if (!obj || typeof obj !== 'object') {
            throw new Error('DramaSession.fromJSON: expected a plain object from toJSON().');
        }
        const session = new DramaSession({
            width: obj.width,
            height: obj.height,
            duration: obj.duration,
            name: obj.name,
        });
        const clips = Array.isArray(obj.clips) ? obj.clips : [];
        clips.forEach((c: any, i: number) => {
            if (!c || typeof c !== 'object') {
                throw new Error(`DramaSession.fromJSON: clips[${i}] must be an object.`);
            }
            const { id, kind, ...input } = c;
            if (id != null) input.id = id;
            session._add(kind, input);
        });
        return session;
    }

    // ----- producing the video -----------------------------------------------

    /** Build the underlying `DramaSchema`. Throws if the composition is invalid. */
    toSchema(): DramaSchema {
        const grouped = this._groupByTrack();
        const layers: DramaLayer[] = [];
        let maxEnd = 0;

        for (const track of [...grouped.keys()].sort((a, b) => a - b)) {
            const clips = grouped.get(track)!;
            const layerTypes = new Set(clips.map((c) => KIND_TO_LAYER_TYPE[c.kind]));
            if (layerTypes.size > 1) {
                const kinds = [...new Set(clips.map((c) => c.kind))].join(', ');
                throw new Error(
                    `DramaSession: track ${track} mixes incompatible clip kinds (${kinds}). ` +
                    `Each track maps to one layer type — put them on separate tracks.`
                );
            }
            for (const c of clips) maxEnd = Math.max(maxEnd, c.input.end);
            layers.push({
                index: track,
                type: [...layerTypes][0],
                items: clips.map((c) => this._toItem(c)),
            });
        }

        const schema: DramaSchema = {
            name: this.opts.name || 'drama-session',
            w: this.opts.width,
            h: this.opts.height,
            d: this.opts.duration ?? maxEnd,
            layers,
        };
        validateSchema(schema);
        return schema;
    }

    /** Construct a `DramaCore` from the current state. */
    toCore(): DramaCore {
        return new DramaCore(this.toSchema());
    }

    /** Render the composition to a file. Resolves with `{ success, output, duration }`. */
    async render(outputPath: string): Promise<{ success: boolean; output: string; duration: number }> {
        const schema = this.toSchema();
        const core = new DramaCore(schema);
        try {
            await core.save(outputPath);
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : (e && e.error) || String(e);
            throw new Error(`DramaSession.render failed: ${msg}`);
        }
        return { success: true, output: outputPath, duration: schema.d };
    }

    /** Render to a streaming (fragmented mp4) output. */
    stream() {
        return new DramaCore(this.toSchema()).getStream();
    }

    // ----- internals ----------------------------------------------------------

    private _add(kind: ClipKind, input: any): string {
        if (!KIND_TO_LAYER_TYPE[kind]) {
            throw new Error(`DramaSession: unknown clip kind "${kind}".`);
        }
        this._validateInput(kind, input, `${kind} clip`);
        const id = input.id != null ? String(input.id) : this._genId(kind);
        if (this.clips.has(id)) {
            throw new Error(`DramaSession: clip id "${id}" already exists.`);
        }
        const { id: _omitId, ...rest } = input;
        this.clips.set(id, { id, kind, input: { ...rest } });
        this.order.push(id);
        return id;
    }

    private _genId(kind: ClipKind): string {
        let id: string;
        do {
            this.counter++;
            id = `${kind}${this.counter}`;
        } while (this.clips.has(id));
        return id;
    }

    private _groupByTrack(): Map<number, StoredClip[]> {
        const grouped = new Map<number, StoredClip[]>();
        for (const id of this.order) {
            const clip = this.clips.get(id)!;
            const track = clip.input.track ?? 0;
            if (!grouped.has(track)) grouped.set(track, []);
            grouped.get(track)!.push(clip);
        }
        // Chronological order within a track: required for `normal` tracks
        // (clips are concatenated) and harmless for the others.
        for (const clips of grouped.values()) {
            clips.sort((a, b) => a.input.start - b.input.start);
        }
        return grouped;
    }

    private _validateInput(kind: ClipKind, input: any, where: string): void {
        if (!input || typeof input !== 'object') {
            throw new Error(`DramaSession: ${where} input must be an object.`);
        }
        if (!isFiniteNumber(input.start) || input.start < 0) {
            throw new Error(`DramaSession: ${where} "start" must be a number >= 0 (got ${JSON.stringify(input.start)}).`);
        }
        if (!isFiniteNumber(input.end)) {
            throw new Error(`DramaSession: ${where} "end" must be a number (got ${JSON.stringify(input.end)}).`);
        }
        if (input.end <= input.start) {
            throw new Error(`DramaSession: ${where} "end" (${input.end}) must be greater than "start" (${input.start}).`);
        }
        if (input.track != null && (!Number.isInteger(input.track) || input.track < 0)) {
            throw new Error(`DramaSession: ${where} "track" must be a non-negative integer (got ${JSON.stringify(input.track)}).`);
        }
        if (input.effects != null && !Array.isArray(input.effects)) {
            throw new Error(`DramaSession: ${where} "effects" must be an array of { nm, options } objects.`);
        }
        if (kind === 'video' || kind === 'image' || kind === 'audio') {
            if (typeof input.url !== 'string' || !input.url) {
                throw new Error(`DramaSession: ${where} "url" (file path or link) is required.`);
            }
        }
        if (kind === 'text') {
            if (typeof input.text !== 'string' || !input.text) {
                throw new Error(`DramaSession: ${where} "text" is required.`);
            }
            if (typeof input.fontFile !== 'string' || !input.fontFile) {
                throw new Error(`DramaSession: ${where} "fontFile" (path to a .ttf) is required — ffmpeg's drawtext needs a font.`);
            }
        }
        if (kind === 'lottie') {
            if (!input.lottie || typeof input.lottie !== 'object') {
                throw new Error(`DramaSession: ${where} "lottie" animation data object is required.`);
            }
            if (!isFiniteNumber(input.width) || !isFiniteNumber(input.height)) {
                throw new Error(`DramaSession: ${where} "width" and "height" are required for lottie clips.`);
            }
        }
    }

    /** Convert a stored clip into a schema item for its layer. */
    private _toItem(clip: StoredClip): DramaItem {
        const { kind, id, input } = clip;

        // Convenience props become leading effects, then any raw effects follow.
        const effects: DramaEffect[] = [];
        if ((kind === 'video' || kind === 'image') && (input.width != null || input.height != null)) {
            effects.push({ nm: 'scale', options: { w: input.width ?? -2, h: input.height ?? -2 } });
        }
        if (kind === 'audio' && input.volume != null) {
            effects.push({ nm: 'volume', options: input.volume });
        }
        if (Array.isArray(input.effects)) effects.push(...input.effects);

        if (kind === 'video') {
            return {
                id,
                url: input.url,
                type: 'video',
                config: {
                    st: input.start,
                    et: input.end,
                    seek: input.seek ?? 0,
                    x: input.x ?? 0,
                    y: input.y ?? 0,
                    hasAudio: !!input.hasAudio,
                },
                effects,
            } as DramaItem;
        }
        if (kind === 'image') {
            return {
                id,
                url: input.url,
                type: 'image',
                config: {
                    st: input.start,
                    et: input.end,
                    seek: input.seek ?? 0,
                    x: input.x ?? 0,
                    y: input.y ?? 0,
                },
                effects,
            } as DramaItem;
        }
        if (kind === 'audio') {
            return {
                id,
                url: input.url,
                type: 'audio',
                config: {
                    st: input.start,
                    et: input.end,
                    seek: input.seek ?? 0,
                },
                effects,
            } as DramaItem;
        }
        if (kind === 'text') {
            const config: any = {
                text: input.text,
                st: input.start,
                et: input.end,
                x: input.x ?? '(w-text_w)/2',
                y: input.y ?? '(h-text_h)/2',
                ttfPath: input.fontFile,
            };
            if (input.fontSize != null) config.fontsize = input.fontSize;
            if (input.fontColor != null) config.fontcolor = input.fontColor;
            if (input.borderColor != null) config.bordercolor = input.borderColor;
            if (input.borderWidth != null) config.borderw = input.borderWidth;
            if (input.outerBorderColor != null) config.obc = input.outerBorderColor;
            if (input.outerBorderWidth != null) config.obw = input.outerBorderWidth;
            if (input.lineSpacing != null) config.line_spacing = input.lineSpacing;
            return { id, type: 'text', config } as DramaItem;
        }
        // lottie
        return {
            id,
            type: 'lottie',
            lottie: input.lottie,
            config: {
                x: input.x ?? 0,
                y: input.y ?? 0,
                st: input.start,
                et: input.end,
                fps: input.fps ?? 30,
                w: input.width,
                h: input.height,
                seek: input.seek ?? 0,
            },
        } as DramaItem;
    }
}
