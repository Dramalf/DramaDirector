'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateSchema, DramaSchemaError } = require('../dist');

const baseItem = (over = {}) => ({
    id: 'v0',
    url: '/tmp/a.mp4',
    type: 'video',
    config: { st: 0, et: 2 },
    effects: [],
    ...over,
});

test('accepts a well-formed schema', () => {
    assert.doesNotThrow(() =>
        validateSchema({
            name: 'ok',
            w: 100,
            h: 100,
            d: 2,
            layers: [{ index: 0, type: 'normal', items: [baseItem()] }],
        })
    );
});

test('rejects non-positive canvas dimensions', () => {
    assert.throws(
        () => validateSchema({ w: 0, h: -1, layers: [] }),
        (e) => e instanceof DramaSchemaError && /schema\.w/.test(e.message) && /schema\.h/.test(e.message)
    );
});

test('rejects an unknown layer type', () => {
    assert.throws(
        () => validateSchema({ w: 10, h: 10, layers: [{ index: 0, type: 'bogus', items: [] }] }),
        /layers\[0\]\.type "bogus" is not supported/
    );
});

test('rejects an unknown item type', () => {
    assert.throws(
        () =>
            validateSchema({
                w: 10,
                h: 10,
                layers: [{ index: 0, type: 'normal', items: [baseItem({ type: 'hologram' })] }],
            }),
        /items\[0\]\.type "hologram" is not supported/
    );
});

test('rejects duplicate item ids', () => {
    assert.throws(
        () =>
            validateSchema({
                w: 10,
                h: 10,
                layers: [
                    { index: 0, type: 'normal', items: [baseItem({ id: 'dup' })] },
                    { index: 1, type: 'normal', items: [baseItem({ id: 'dup' })] },
                ],
            }),
        /id "dup" is duplicated/
    );
});

test('rejects et < st', () => {
    assert.throws(
        () =>
            validateSchema({
                w: 10,
                h: 10,
                layers: [{ index: 0, type: 'normal', items: [baseItem({ config: { st: 5, et: 1 } })] }],
            }),
        /config\.et \(1\) must be >= config\.st \(5\)/
    );
});

test('requires url for video/image/audio items', () => {
    assert.throws(
        () =>
            validateSchema({
                w: 10,
                h: 10,
                layers: [{ index: 0, type: 'normal', items: [baseItem({ url: undefined })] }],
            }),
        /url is required for video items/
    );
});

test('collects every problem into one error', () => {
    try {
        validateSchema({ w: 0, h: 0, layers: [{ index: 0, type: 'normal', items: [baseItem({ id: undefined, url: '' })] }] });
        assert.fail('should have thrown');
    } catch (e) {
        const lines = e.message.split('\n').filter((l) => l.trim().startsWith('-'));
        assert.ok(lines.length >= 3, `expected several problems, got:\n${e.message}`);
    }
});
