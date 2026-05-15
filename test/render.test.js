'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { DramaSession } = require('../dist');
const { ensureFixtures } = require('./fixtures');

const OUT_DIR = path.join(__dirname, '.out');
const rendered = (file) => fs.existsSync(file) && fs.statSync(file).size > 1000;

test.before(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
});

test('renders a multi-track composition end to end', { timeout: 180000 }, async () => {
    const assets = ensureFixtures();
    const session = new DramaSession({ width: 320, height: 240, name: 'render-test' });

    // track 0: two clips back to back
    session.addVideo({ url: assets.red, track: 0, start: 0, end: 2 });
    session.addVideo({ url: assets.blue, track: 0, start: 2, end: 4 });
    // track 1: a logo overlay for the whole thing
    session.addImage({ url: assets.logo, track: 1, start: 0, end: 4, x: 10, y: 10 });
    // track 2: background audio
    session.addAudio({ url: assets.tone, track: 2, start: 0, end: 4, volume: '-3dB' });

    const out = path.join(OUT_DIR, 'multi-track.mp4');
    const result = await session.render(out);

    assert.equal(result.success, true);
    assert.equal(result.output, out);
    assert.equal(result.duration, 4);
    assert.ok(rendered(out), 'output file should exist and be non-trivial');
});

test('renders a video-only composition (no audio track)', { timeout: 180000 }, async () => {
    const assets = ensureFixtures();
    const session = new DramaSession({ width: 160, height: 120 });
    session.addVideo({ url: assets.blue, start: 0, end: 2, width: 160, height: 120 });

    const out = path.join(OUT_DIR, 'video-only.mp4');
    const result = await session.render(out);
    assert.equal(result.success, true);
    assert.ok(rendered(out), 'video-only output should render without an audio track');
});

test('a second render is unaffected by the first (no shared state)', { timeout: 180000 }, async () => {
    const assets = ensureFixtures();

    const a = new DramaSession({ width: 320, height: 240 });
    a.addVideo({ url: assets.red, start: 0, end: 2 });
    a.addAudio({ url: assets.tone, track: 1, start: 0, end: 2 });

    const b = new DramaSession({ width: 160, height: 120 });
    b.addVideo({ url: assets.blue, start: 0, end: 2, width: 160, height: 120 });

    const outA = path.join(OUT_DIR, 'iso-a.mp4');
    const outB = path.join(OUT_DIR, 'iso-b.mp4');

    await a.render(outA);
    await b.render(outB);

    assert.ok(rendered(outA), 'first render should succeed');
    assert.ok(rendered(outB), 'second render should succeed independently');
});

test('render surfaces a clear error for a bad composition', async () => {
    const s = new DramaSession({ width: 100, height: 100 });
    s.addVideo({ url: '/tmp/a.mp4', track: 0, start: 0, end: 2 });
    s.addText({ text: 'x', fontFile: '/f.ttf', track: 0, start: 0, end: 2 });
    await assert.rejects(() => s.render(path.join(OUT_DIR, 'never.mp4')), /mixes incompatible clip kinds/);
});
