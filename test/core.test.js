'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DramaCore = require('../dist').default;

// A schema with `n` audio clips on their own track. getFilters() is pure
// (no ffmpeg), but it exercises the per-run state that used to be static.
const audioSchema = (w, n) => ({
    name: 'ctx',
    w,
    h: w,
    d: 2,
    layers: Array.from({ length: n }, (_, i) => ({
        index: i,
        type: 'audio',
        items: [{ id: `a${w}_${i}`, url: '/tmp/x.mp3', type: 'audio', config: { st: 0, et: 2 }, effects: [] }],
    })),
});

test('two cores keep independent baseInfo', () => {
    const a = new DramaCore(audioSchema(100, 1));
    const b = new DramaCore(audioSchema(200, 1));
    assert.notEqual(a.baseInfo, b.baseInfo);
    assert.equal(a.baseInfo.w, 100);
    assert.equal(b.baseInfo.w, 200);
});

test('audio outputs do not bleed between core instances', () => {
    const a = new DramaCore(audioSchema(100, 1));
    const b = new DramaCore(audioSchema(200, 3));

    a.produce();
    a.getFilters();
    assert.equal(a.audioOutputs.length, 1);

    b.produce();
    b.getFilters();
    assert.equal(b.audioOutputs.length, 3);

    // Building b must not have touched a.
    assert.equal(a.audioOutputs.length, 1);
});

test('re-running produce()/getFilters() on the same core does not accumulate state', () => {
    const a = new DramaCore(audioSchema(100, 2));
    a.produce();
    a.getFilters();
    assert.equal(a.audioOutputs.length, 2);

    a.produce();
    a.getFilters();
    assert.equal(a.audioOutputs.length, 2, 'audioOutputs should reset, not grow, on re-run');
});

test('invalid schema is rejected at construction time', () => {
    assert.throws(() => new DramaCore({ w: 10, h: 10, layers: [{ index: 0, type: 'oops', items: [] }] }), /not supported/);
});
