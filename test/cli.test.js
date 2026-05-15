'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureFixtures } = require('./fixtures');

const BIN = path.join(__dirname, '..', 'bin', 'drama.js');
const OUT_DIR = path.join(__dirname, '.out');

function drama(...args) {
    return spawnSync('node', [BIN, ...args], { encoding: 'utf8' });
}

function freshSession() {
    const file = path.join(OUT_DIR, `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    return file;
}

test.before(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
});

test('help is printed for empty/--help invocations', () => {
    const a = drama();
    assert.equal(a.status, 0);
    assert.match(a.stdout, /drama — DramaDirector CLI/);
    const b = drama('--help');
    assert.equal(b.status, 0);
    assert.match(b.stdout, /add-video/);
});

test('unknown command exits non-zero with a clear error', () => {
    const r = drama('does-not-exist');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown command "does-not-exist"/);
});

test('init creates a session file and rejects re-init', () => {
    const file = freshSession();
    const a = drama('init', file, '--width=320', '--height=240');
    assert.equal(a.status, 0, a.stderr);
    assert.ok(fs.existsSync(file));
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.width, 320);
    assert.equal(data.height, 240);

    const b = drama('init', file, '--width=10', '--height=10');
    assert.notEqual(b.status, 0);
    assert.match(b.stderr, /already exists/);
});

test('init reports missing required flags', () => {
    const file = freshSession();
    const r = drama('init', file, '--width=320');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--height is required/);
});

test('add-* prints the new clip id on stdout and persists', () => {
    const file = freshSession();
    assert.equal(drama('init', file, '--width=320', '--height=240').status, 0);
    const r = drama('add-video', file, '--url=/tmp/a.mp4', '--track=0', '--start=0', '--end=5');
    assert.equal(r.status, 0, r.stderr);
    const id = r.stdout.trim();
    assert.equal(id, 'video1');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.clips.length, 1);
    assert.equal(data.clips[0].id, 'video1');
    assert.equal(data.clips[0].url, '/tmp/a.mp4');
    assert.equal(data.clips[0].end, 5);
});

test('add-* validation errors surface cleanly', () => {
    const file = freshSession();
    drama('init', file, '--width=320', '--height=240');
    const a = drama('add-video', file, '--start=0', '--end=5');
    assert.notEqual(a.status, 0);
    assert.match(a.stderr, /--url is required/);
    const b = drama('add-video', file, '--url=/x', '--start=5', '--end=2');
    assert.notEqual(b.status, 0);
    assert.match(b.stderr, /"end" \(2\) must be greater than "start" \(5\)/);
});

test('update edits a clip; get reflects it', () => {
    const file = freshSession();
    drama('init', file, '--width=320', '--height=240');
    drama('add-video', file, '--url=/tmp/a.mp4', '--start=0', '--end=5');
    const u = drama('update', file, 'video1', '--end=8');
    assert.equal(u.status, 0, u.stderr);
    const g = drama('get', file, 'video1');
    assert.equal(g.status, 0);
    const clip = JSON.parse(g.stdout);
    assert.equal(clip.end, 8);
});

test('update requires at least one option', () => {
    const file = freshSession();
    drama('init', file, '--width=320', '--height=240');
    drama('add-video', file, '--url=/tmp/a.mp4', '--start=0', '--end=5');
    const r = drama('update', file, 'video1');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /nothing to update/);
});

test('summary returns valid JSON describing the tracks', () => {
    const file = freshSession();
    drama('init', file, '--width=320', '--height=240');
    drama('add-video', file, '--url=/tmp/a.mp4', '--track=0', '--start=0', '--end=2');
    drama('add-image', file, '--url=/tmp/i.png', '--track=1', '--start=0', '--end=2');
    const r = drama('summary', file);
    assert.equal(r.status, 0, r.stderr);
    const sum = JSON.parse(r.stdout);
    assert.equal(sum.clipCount, 2);
    assert.equal(sum.tracks.length, 2);
    assert.deepEqual(sum.tracks.map((t) => t.track), [0, 1]);
});

test('remove deletes by id; missing id is an error', () => {
    const file = freshSession();
    drama('init', file, '--width=320', '--height=240');
    drama('add-video', file, '--url=/tmp/a.mp4', '--start=0', '--end=2');
    assert.equal(drama('remove', file, 'video1').status, 0);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.clips.length, 0);
    const r = drama('remove', file, 'video1');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no clip with id "video1"/);
});

test('full agent-style flow: init → adds → render', { timeout: 180000 }, () => {
    const assets = ensureFixtures();
    const file = freshSession();
    const out = path.join(OUT_DIR, `cli-render-${Date.now()}.mp4`);

    assert.equal(drama('init', file, '--width=320', '--height=240', '--name=cli-demo').status, 0);

    assert.equal(drama('add-video', file,
        `--url=${assets.red}`, '--track=0', '--start=0', '--end=2').status, 0);
    assert.equal(drama('add-video', file,
        `--url=${assets.blue}`, '--track=0', '--start=2', '--end=4').status, 0);
    assert.equal(drama('add-image', file,
        `--url=${assets.logo}`, '--track=1', '--start=0', '--end=4', '--x=10', '--y=10').status, 0);
    assert.equal(drama('add-audio', file,
        `--url=${assets.tone}`, '--track=2', '--start=0', '--end=4', '--volume=-3dB').status, 0);

    const r = drama('render', file, out);
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.success, true);
    assert.equal(result.duration, 4);
    assert.ok(fs.existsSync(out) && fs.statSync(out).size > 1000);
});
