'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { DramaSession } = require('../dist');

const newSession = () => new DramaSession({ width: 720, height: 1280 });

test('constructor validates canvas dimensions', () => {
    assert.throws(() => new DramaSession({ width: 0, height: 100 }), /"width" must be a positive number/);
    assert.throws(() => new DramaSession({}), /"width" must be a positive number/);
    assert.doesNotThrow(() => new DramaSession({ width: 10, height: 10 }));
});

test('addVideo returns an id and stores the clip', () => {
    const s = newSession();
    const id = s.addVideo({ url: 'a.mp4', start: 0, end: 3 });
    assert.equal(typeof id, 'string');
    assert.ok(s.has(id));
    const clip = s.get(id);
    assert.equal(clip.kind, 'video');
    assert.equal(clip.url, 'a.mp4');
    assert.equal(clip.end, 3);
});

test('auto-generated ids are unique and kind-prefixed', () => {
    const s = newSession();
    const a = s.addVideo({ url: 'a.mp4', start: 0, end: 1 });
    const b = s.addVideo({ url: 'b.mp4', start: 1, end: 2 });
    const t = s.addText({ text: 'hi', fontFile: 'f.ttf', start: 0, end: 1 });
    assert.notEqual(a, b);
    assert.match(a, /^video\d+$/);
    assert.match(t, /^text\d+$/);
});

test('explicit duplicate ids are rejected', () => {
    const s = newSession();
    s.addVideo({ id: 'hero', url: 'a.mp4', start: 0, end: 1 });
    assert.throws(() => s.addVideo({ id: 'hero', url: 'b.mp4', start: 1, end: 2 }), /already exists/);
});

test('add validates required fields and timing', () => {
    const s = newSession();
    assert.throws(() => s.addVideo({ start: 0, end: 1 }), /"url" .* is required/);
    assert.throws(() => s.addVideo({ url: 'a.mp4', start: 2, end: 1 }), /"end" \(1\) must be greater than "start" \(2\)/);
    assert.throws(() => s.addText({ text: 'hi', start: 0, end: 1 }), /"fontFile" .* is required/);
    assert.throws(() => s.addLottie({ lottie: {}, start: 0, end: 1 }), /"width" and "height" are required/);
    assert.throws(() => s.addVideo({ url: 'a.mp4', start: 0, end: 1, track: -1 }), /"track" must be a non-negative integer/);
});

test('update merges a patch and re-validates', () => {
    const s = newSession();
    const id = s.addVideo({ url: 'a.mp4', start: 0, end: 3 });
    s.update(id, { end: 5, x: 10 });
    assert.equal(s.get(id).end, 5);
    assert.equal(s.get(id).x, 10);
    assert.equal(s.get(id).url, 'a.mp4');
    assert.throws(() => s.update(id, { end: -1 }), /"end" .* must be greater/);
    assert.throws(() => s.update(id, { kind: 'audio' }), /cannot be changed via update/);
    assert.throws(() => s.update('nope', { end: 1 }), /no clip with id "nope"/);
});

test('remove and clear', () => {
    const s = newSession();
    const id = s.addVideo({ url: 'a.mp4', start: 0, end: 1 });
    assert.equal(s.remove(id), true);
    assert.equal(s.remove(id), false);
    assert.equal(s.has(id), false);
    s.addVideo({ url: 'a.mp4', start: 0, end: 1 });
    s.addImage({ url: 'i.png', start: 0, end: 1 });
    s.clear();
    assert.equal(s.size, 0);
});

test('toSchema groups clips by track into ordered layers', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', track: 0, start: 0, end: 2 });
    s.addImage({ url: 'i.png', track: 2, start: 0, end: 2 });
    s.addAudio({ url: 'm.mp3', track: 1, start: 0, end: 2 });
    const schema = s.toSchema();
    assert.deepEqual(schema.layers.map((l) => l.index), [0, 1, 2]);
    assert.deepEqual(schema.layers.map((l) => l.type), ['normal', 'audio', 'normal']);
    assert.equal(schema.w, 720);
    assert.equal(schema.h, 1280);
});

test('toSchema sorts clips within a track chronologically', () => {
    const s = newSession();
    s.addVideo({ id: 'late', url: 'b.mp4', track: 0, start: 5, end: 8 });
    s.addVideo({ id: 'early', url: 'a.mp4', track: 0, start: 0, end: 5 });
    const items = s.toSchema().layers[0].items;
    assert.deepEqual(items.map((i) => i.id), ['early', 'late']);
});

test('toSchema rejects a track with mixed clip kinds', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', track: 0, start: 0, end: 2 });
    s.addAudio({ url: 'm.mp3', track: 0, start: 0, end: 2 });
    assert.throws(() => s.toSchema(), /track 0 mixes incompatible clip kinds/);
});

test('duration defaults to the latest clip end', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', start: 0, end: 4 });
    s.addImage({ url: 'i.png', track: 1, start: 0, end: 9 });
    assert.equal(s.toSchema().d, 9);
    const fixed = new DramaSession({ width: 10, height: 10, duration: 20 });
    fixed.addVideo({ url: 'a.mp4', start: 0, end: 4 });
    assert.equal(fixed.toSchema().d, 20);
});

test('width/height become a leading scale effect', () => {
    const s = newSession();
    const id = s.addVideo({ url: 'a.mp4', start: 0, end: 2, width: 720, height: -2 });
    const item = s.toSchema().layers[0].items[0];
    assert.deepEqual(item.effects[0], { nm: 'scale', options: { w: 720, h: -2 } });
    void id;
});

test('audio volume becomes a leading volume effect', () => {
    const s = newSession();
    s.addAudio({ url: 'm.mp3', start: 0, end: 2, volume: '+6dB' });
    const item = s.toSchema().layers[0].items[0];
    assert.deepEqual(item.effects[0], { nm: 'volume', options: '+6dB' });
});

test('raw effects follow the convenience ones', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', start: 0, end: 2, width: 100, effects: [{ nm: 'boxblur', options: '5' }] });
    const item = s.toSchema().layers[0].items[0];
    assert.equal(item.effects[0].nm, 'scale');
    assert.equal(item.effects[1].nm, 'boxblur');
});

test('text friendly props map to schema config keys', () => {
    const s = newSession();
    s.addText({
        text: 'hello',
        fontFile: '/f.ttf',
        start: 0,
        end: 2,
        fontSize: 40,
        fontColor: '#fff',
        borderWidth: 3,
        outerBorderColor: '#000',
    });
    const cfg = s.toSchema().layers[0].items[0].config;
    assert.equal(cfg.text, 'hello');
    assert.equal(cfg.ttfPath, '/f.ttf');
    assert.equal(cfg.fontsize, 40);
    assert.equal(cfg.fontcolor, '#fff');
    assert.equal(cfg.borderw, 3);
    assert.equal(cfg.obc, '#000');
});

test('toJSON / fromJSON round-trips the session', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', track: 0, start: 0, end: 2, width: 720 });
    s.addText({ id: 'caption', text: 'hi', fontFile: '/f.ttf', track: 1, start: 0, end: 2 });
    const json = JSON.parse(JSON.stringify(s.toJSON()));
    const restored = DramaSession.fromJSON(json);
    assert.deepEqual(restored.toJSON(), s.toJSON());
    assert.deepEqual(restored.toSchema(), s.toSchema());
    assert.ok(restored.has('caption'));
});

test('summary reports tracks, clips and duration', () => {
    const s = newSession();
    s.addVideo({ url: 'a.mp4', track: 0, start: 0, end: 3 });
    s.addText({ text: 'hi', fontFile: '/f.ttf', track: 1, start: 1, end: 2 });
    const sum = s.summary();
    assert.equal(sum.clipCount, 2);
    assert.equal(sum.duration, 3);
    assert.equal(sum.tracks.length, 2);
    assert.equal(sum.tracks[0].layerType, 'normal');
    assert.equal(sum.tracks[1].layerType, 'text');
});

test('sessions are independent of one another', () => {
    const a = newSession();
    const b = newSession();
    a.addVideo({ url: 'a.mp4', start: 0, end: 1 });
    assert.equal(a.size, 1);
    assert.equal(b.size, 0);
});
