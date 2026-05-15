'use strict';
/**
 * Mock asset generator for tests and the session example.
 *
 * Real renders need real files. Rather than committing binary assets, we
 * synthesize tiny ones with the bundled ffmpeg (lavfi color/sine sources).
 * Generation is idempotent — assets are made once and reused.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function ffmpeg(args) {
    execFileSync(ffmpegPath, ['-y', ...args], { stdio: 'ignore' });
}

/**
 * Ensure the mock assets exist; returns their absolute paths.
 *   red   — 2s 320x240 red video with a 440Hz tone
 *   blue  — 2s 320x240 blue video (no audio)
 *   logo  — single-frame 80x80 yellow PNG
 *   tone  — 2s 220Hz audio clip
 */
function ensureFixtures() {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });

    const assets = {
        red: path.join(FIXTURES_DIR, 'red.mp4'),
        blue: path.join(FIXTURES_DIR, 'blue.mp4'),
        logo: path.join(FIXTURES_DIR, 'logo.png'),
        tone: path.join(FIXTURES_DIR, 'tone.mp3'),
    };

    if (!fs.existsSync(assets.red)) {
        ffmpeg([
            '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=2:r=24',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
            '-shortest', '-pix_fmt', 'yuv420p', assets.red,
        ]);
    }
    if (!fs.existsSync(assets.blue)) {
        ffmpeg([
            '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=2:r=24',
            '-pix_fmt', 'yuv420p', assets.blue,
        ]);
    }
    if (!fs.existsSync(assets.logo)) {
        ffmpeg([
            '-f', 'lavfi', '-i', 'color=c=yellow:s=80x80:d=1',
            '-frames:v', '1', assets.logo,
        ]);
    }
    if (!fs.existsSync(assets.tone)) {
        ffmpeg([
            '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', assets.tone,
        ]);
    }

    return assets;
}

module.exports = { ensureFixtures, FIXTURES_DIR };
