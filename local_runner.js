/**
 * Local test runner for Mangasteen source extensions.
 *
 * Mocks the two globals injected by the app at runtime:
 *   - globalThis.httpGet     → axios
 *   - globalThis.ksoupSelect → cheerio
 *
 * Usage:
 *   npm run local
 *
 * Uncomment the test blocks below to exercise each function.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ---------------------------------------------------------------------------
// 1. Mock httpGet
// ---------------------------------------------------------------------------
globalThis.httpGet = async function (url, options = {}) {
    console.log('Fetching:', url, options.params ? JSON.stringify(options.params) : '');

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(options.headers || {}),
    };

    const config = { headers, params: options.params };
    const response = await axios.get(url, config);

    return {
        body:   typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data),
        url:    response.config.url ?? url,
        status: response.status,
    };
};

// ---------------------------------------------------------------------------
// 2. Mock ksoupSelect
// ---------------------------------------------------------------------------
globalThis.ksoupSelect = function (html, selector) {
    const $ = cheerio.load(html, { xmlMode: false, decodeEntities: false }, false);
    const results = [];

    $(selector).each((_, element) => {
        const el   = $(element);
        const attr = {};
        for (const key in element.attribs) {
            attr[key] = element.attribs[key];
        }
        results.push({
            text:      el.text(),
            outerHtml: $.html(element),
            innerHtml: el.html(),
            attr,
        });
    });

    return results;
};

// ---------------------------------------------------------------------------
// 3. Load the extension
// Change the path below to point to the source you want to test.
// ---------------------------------------------------------------------------
const SOURCE_PATH = path.join(__dirname, 'sources/my-source/main.js');
eval(fs.readFileSync(SOURCE_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// 4. Run tests
// Uncomment the blocks you want to run.
// ---------------------------------------------------------------------------
(async () => {
    try {
        // --- getPopularManga ---
        // console.log('--- getPopularManga ---');
        // const popular = await getPopularManga(1);
        // console.log('Results:', popular.length);
        // if (popular.length) console.log('First:', popular[0]);

        // --- getLatestManga ---
        // console.log('--- getLatestManga ---');
        // const latest = await getLatestManga(1);
        // console.log('Results:', latest.length);
        // if (latest.length) console.log('First:', latest[0]);

        // --- searchManga ---
        // console.log('--- searchManga ---');
        // const search = await searchManga('one piece', 1);
        // console.log('Results:', search.length);
        // if (search.length) console.log('First:', search[0]);

        // --- getMangaDetails ---
        // console.log('--- getMangaDetails ---');
        // const details = await getMangaDetails('https://example.com/manga/some-title');
        // console.log('Details:', details);

        // --- getChapterList ---
        // console.log('--- getChapterList ---');
        // const chapters = await getChapterList('https://example.com/manga/some-title');
        // console.log('Chapters:', chapters.length);
        // if (chapters.length) console.log('First:', chapters[0]);

        // --- getPageList ---
        // console.log('--- getPageList ---');
        // const pages = await getPageList('https://example.com/manga/some-title/chapter-1');
        // console.log('Pages:', pages.length);
        // if (pages.length) console.log('First:', pages[0]);

        console.log('Uncomment a test block in local_runner.js to run tests.');
    } catch (e) {
        console.error('Runner failed:', e);
    }
})();
