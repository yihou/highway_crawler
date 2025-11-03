// save as download_livecam.js
// Usage: node download_livecam.js
// Requires: npm i puppeteer

import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

// === Config ===
const TARGET_PAGE = 'https://visitaso.com/livecam/030/view4x.html';
const IMAGE_SELECTOR = '#main_image';
const FALLBACK_IMAGE_URL = 'https://visitaso.com/livecam/030/view4x.jpg'; // direct JPG
const OUTPUT_DIR = path.resolve('./aso_snapshots');
const INTERVAL_MS = 10000;
const MAX_IMAGES = Infinity; // set a number to stop after N images

// === Helpers ===
function tsFilename(prefix = 'aso') {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${ts}.jpg`;
}

async function ensureDir(dir) {
    await fs.mkdir(dir, {recursive: true});
}

async function getCurrentImageSrc(page) {
    try {
        const src = await page.$eval(IMAGE_SELECTOR, el => el.getAttribute('src'));
        // If page uses relative src like "images/image10.jpg?...", resolve it
        if (!src) return null;
        const absolute = new URL(src, page.url()).toString();
        return absolute;
    } catch {
        return null;
    }
}

async function downloadToFile(url, filePath) {
    // Add cache-buster
    const u = new URL(url);
    u.searchParams.set('t', Date.now().toString());

    const res = await fetch(u.toString(), {cache: 'no-store'});
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${u}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buf);
}

// === Main ===
(async () => {
    await ensureDir(OUTPUT_DIR);

    const browser = await puppeteer.launch({
        headless: 'new', // or true
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Be polite: minimal concurrency and a realistic UA
    await page.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    );

    console.log(`Opening ${TARGET_PAGE} ...`);
    await page.goto(TARGET_PAGE, {waitUntil: 'domcontentloaded', timeout: 60_000});

    // Ensure the main image is present (the page script swaps its src rapidly)
    await page.waitForSelector(IMAGE_SELECTOR, {timeout: 30_000});
    console.log(`Found #main_image — starting ${INTERVAL_MS / 1000}s capture loop. Press Ctrl+C to stop.`);

    let count = 0;
    let stopping = false;

    const stop = async () => {
        if (stopping) return;
        stopping = true;
        console.log('\nStopping … closing browser.');
        try {
            await browser.close();
        } catch {
        }
        process.exit(0);
    };

    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    const tick = async () => {
        if (stopping) return;

        try {
            // Prefer the page’s currently shown image; if not available, use the canonical JPG
            const src = (await getCurrentImageSrc(page)) || FALLBACK_IMAGE_URL;
            const filename = tsFilename();

            // Save inside a date-based subfolder (e.g., aso_snapshots/2025-11-03)
            const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const dayDir = path.join(OUTPUT_DIR, dateFolder);
            await ensureDir(dayDir);
            const outPath = path.join(dayDir, filename);

            await downloadToFile(src, outPath);
            count++;
            console.log(`[${new Date().toLocaleTimeString()}] Saved ${path.join(dateFolder, filename)}`);

            if (count >= MAX_IMAGES) {
                await stop();
                return;
            }
        } catch (err) {
            console.warn('Download failed:', err?.message || err);
        }

        // Schedule next grab
        setTimeout(tick, INTERVAL_MS);
    };

    // Kick off
    await tick();
})();