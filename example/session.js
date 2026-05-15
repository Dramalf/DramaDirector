/**
 * Agent-style usage: build a composition incrementally with DramaSession,
 * inspect it, tweak a clip by id, then render.
 *
 *   npm run build && npm run demo:session
 */
const path = require('path');
const { DramaSession } = require('../dist');

const asset = (f) => path.join(__dirname, 'assets', f);

async function run() {
    const session = new DramaSession({ width: 750, height: 1000, name: 'session-demo' });

    // An agent adds clips as upstream tools (video gen, TTS, image gen...)
    // hand back files. Each track is a z-layer; same track plays back-to-back.
    session.addVideo({ url: asset('videoa.mp4'), track: 0, start: 0, end: 5, width: 750, height: -2 });
    session.addVideo({ url: asset('videob.mp4'), track: 0, start: 5, end: 14, width: 750, height: -2 });
    session.addImage({ url: asset('logo.png'), track: 1, start: 0, end: 14, x: 'main_w-90', y: 10, width: 80 });
    session.addAudio({ url: asset('bgm.mp3'), track: 2, start: 0, end: 14, seek: 4, volume: '+6dB' });

    const caption = session.addText({
        text: '用 DramaSession 拼的视频',
        fontFile: asset('SmileySans-Oblique.ttf'),
        track: 3,
        start: 1,
        end: 5,
        y: 'h/6*5',
        fontSize: 'w*0.8/14',
        fontColor: '#00ff75',
        borderColor: '#ffffff',
        borderWidth: 3,
    });

    // ...and adjusts them later, addressed by id.
    session.update(caption, { end: 9 });

    // Introspect before rendering — agents read this back to decide next steps.
    console.log(JSON.stringify(session.summary(), null, 2));

    const out = path.join(__dirname, 'session-demo.mp4');
    console.time('render');
    const result = await session.render(out);
    console.timeEnd('render');
    console.log('done:', result);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
