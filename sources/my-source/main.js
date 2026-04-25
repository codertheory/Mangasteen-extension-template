/// <reference path="./host-globals.d.ts" />

/**
 * @name My Source Name
 * @version 1.0
 * @lang en
 * @iconUrl https://example.com/favicon.png
 *
 * Prefer declaring metadata in `extension.json` (sibling file). The host reads
 * it at install time — fields there override these JSDoc tags.
 */

// Globals (httpGet / ksoupSelect / crypto / clearCookies) and source-function
// signatures are declared in host-globals.d.ts — run `npm run typecheck` to
// have tsc --noEmit validate this file against the host contract.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://example.com';

// ---------------------------------------------------------------------------
// Required extension functions
// Each function must be assigned to globalThis so the engine can call it.
// ---------------------------------------------------------------------------

/**
 * Returns a list of currently popular manga.
 *
 * @param {number} page - 1-based page number
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   coverUrl: string,
 *   status: string,
 *   description: string,
 *   author: string,
 *   artist: string,
 *   genres?: string[]
 * }>>}
 */
globalThis.getPopularManga = async function getPopularManga(page) {
    try {
        const html = (await httpGet(BASE_URL + '/popular')).body;
        const items = ksoupSelect(html, '.manga-item');
        const results = [];

        for (const item of items) {
            const titleEl = ksoupSelect(item.outerHtml, 'a.title')[0];
            const imgEl   = ksoupSelect(item.outerHtml, 'img')[0];

            if (titleEl && imgEl) {
                results.push({
                    title:       titleEl.text.trim(),
                    url:         titleEl.attr['href'],
                    coverUrl:    imgEl.attr['src'],
                    status:      'Ongoing',
                    description: '',
                    author:      '',
                    artist:      '',
                });
            }
        }
        return results;
    } catch (error) {
        console.log('getPopularManga error: ' + error);
        return [];
    }
};

/**
 * Returns a list of recently updated manga.
 *
 * @param {number} page - 1-based page number
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   coverUrl: string,
 *   status: string,
 *   description: string,
 *   author: string,
 *   artist: string,
 *   genres?: string[]
 * }>>}
 */
globalThis.getLatestManga = async function getLatestManga(page) {
    try {
        const html = (await httpGet(BASE_URL + '/latest?page=' + page)).body;
        const items = ksoupSelect(html, '.manga-item');
        const results = [];

        for (const item of items) {
            const titleEl  = ksoupSelect(item.outerHtml, 'a.title')[0];
            const imgEl    = ksoupSelect(item.outerHtml, 'img')[0];
            const statusEl = ksoupSelect(item.outerHtml, '.status')[0];

            if (titleEl && imgEl) {
                results.push({
                    title:       titleEl.text.trim(),
                    url:         titleEl.attr['href'],
                    coverUrl:    imgEl.attr['src'],
                    status:      statusEl ? statusEl.text.trim() : 'Unknown',
                    description: '',
                    author:      '',
                    artist:      '',
                });
            }
        }
        return results;
    } catch (error) {
        console.log('getLatestManga error: ' + error);
        return [];
    }
};

/**
 * Searches for manga matching the given query string.
 *
 * @param {string} query
 * @param {number} page - 1-based page number
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   coverUrl: string,
 *   status: string,
 *   description: string,
 *   author: string,
 *   artist: string,
 *   genres?: string[]
 * }>>}
 */
globalThis.searchManga = async function searchManga(query, page) {
    try {
        const response = await httpGet(BASE_URL + '/search', {
            params: { q: query, page: String(page) }
        });
        const html = response.body;
        const items = ksoupSelect(html, '.manga-item');
        const results = [];

        for (const item of items) {
            const titleEl = ksoupSelect(item.outerHtml, 'a.title')[0];
            const imgEl   = ksoupSelect(item.outerHtml, 'img')[0];

            if (titleEl && imgEl) {
                results.push({
                    title:       titleEl.text.trim(),
                    url:         titleEl.attr['href'],
                    coverUrl:    imgEl.attr['src'],
                    status:      'Unknown',
                    description: '',
                    author:      '',
                    artist:      '',
                });
            }
        }
        return results;
    } catch (error) {
        console.log('searchManga error: ' + error);
        return [];
    }
};

/**
 * Returns full details for a manga plus its chapter list.
 *
 * @param {string} url - The manga's detail page URL
 * @returns {Promise<{
 *   manga: {
 *     title: string,
 *     url: string,
 *     coverUrl: string,
 *     status: string,
 *     description: string,
 *     author: string,
 *     artist: string,
 *     genres: string[],
 *     lastUpdate: number
 *   },
 *   chapters: Array<{
 *     name: string,
 *     url: string,
 *     number: number,
 *     uploadDate: number
 *   }>
 * } | null>}
 */
globalThis.getMangaDetails = async function getMangaDetails(url) {
    try {
        const html = (await httpGet(url)).body;

        const titleEl  = ksoupSelect(html, 'h1.title')[0];
        const imgEl    = ksoupSelect(html, '.cover img')[0];
        const statusEl = ksoupSelect(html, '.status')[0];
        const descEl   = ksoupSelect(html, '.description')[0];
        const authorEl = ksoupSelect(html, '.author')[0];

        const genreEls = ksoupSelect(html, '.genres a');
        const genres   = genreEls.map(el => el.text.trim()).filter(Boolean);

        const manga = {
            title:       titleEl  ? titleEl.text.trim()  : '',
            url:         url,
            coverUrl:    imgEl    ? imgEl.attr['src']     : '',
            status:      statusEl ? statusEl.text.trim()  : 'Unknown',
            description: descEl   ? descEl.text.trim()   : '',
            author:      authorEl ? authorEl.text.trim()  : '',
            artist:      authorEl ? authorEl.text.trim()  : '',
            genres:      genres,
            // Unix epoch ms; 0 when the source doesn't expose a "last updated" timestamp.
            lastUpdate:  0,
        };

        const chapters = parseChapters(html);
        return { manga, chapters };
    } catch (error) {
        console.log('getMangaDetails error: ' + error);
        return null;
    }
};

/**
 * Returns the chapter list for a manga.
 * Only implement this if the chapter list is on a separate page from the details page.
 * Otherwise, getMangaDetails should already return chapters and this can delegate to that.
 *
 * @param {string} url - The manga's detail (or chapter list) page URL
 * @returns {Promise<Array<{
 *   name: string,
 *   url: string,
 *   number: number,
 *   uploadDate: number
 * }>>}
 */
globalThis.getChapterList = async function getChapterList(url) {
    try {
        const html = (await httpGet(url)).body;
        return parseChapters(html);
    } catch (error) {
        console.log('getChapterList error: ' + error);
        return [];
    }
};

/**
 * Returns the ordered list of page image URLs for a chapter.
 *
 * @param {string} url - The chapter reader page URL
 * @returns {Promise<string[]>} - Array of image URLs in reading order
 */
globalThis.getPageList = async function getPageList(url) {
    try {
        const html = (await httpGet(url)).body;
        const imgEls = ksoupSelect(html, '.reader-page img');
        return imgEls.map(el => el.attr['src']).filter(Boolean);
    } catch (error) {
        console.log('getPageList error: ' + error);
        return [];
    }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses chapter rows from a manga detail page.
 * Adapt the selectors to match your source's HTML structure.
 *
 * @param {string} html
 * @returns {Array<{ name: string, url: string, number: number, uploadDate: number }>}
 */
function parseChapters(html) {
    const rows = ksoupSelect(html, '.chapter-list .chapter');
    const chapters = [];

    for (const row of rows) {
        const linkEl = ksoupSelect(row.outerHtml, 'a')[0];
        const dateEl = ksoupSelect(row.outerHtml, '.date')[0];

        if (!linkEl) continue;

        const name  = linkEl.text.trim();
        const match = name.match(/Chapter\s+([0-9.]+)/i);
        const number = match ? parseFloat(match[1]) : -1.0;

        // Unix epoch ms. Replace Date.parse with a source-specific parser when
        // the site uses a custom format (e.g. "2 days ago").
        const parsedDate = dateEl ? Date.parse(dateEl.text.trim()) : NaN;
        const uploadDate = Number.isFinite(parsedDate) ? parsedDate : 0;

        chapters.push({
            name:       name,
            url:        linkEl.attr['href'],
            number:     number,
            uploadDate: uploadDate,
        });
    }
    return chapters;
}
