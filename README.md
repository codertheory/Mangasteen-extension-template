# Mangasteen Source Extension Template

A starting point for writing source extensions for the **Mangasteen** manga reader app (Android/iOS, built with KMP).

## What is a source extension?

An extension implements the parsing logic for a specific manga website. The Mangasteen app embeds **[QuickJS](https://bellard.org/quickjs/)** — a small, embeddable JavaScript engine — that loads your extension at runtime and calls its functions to search for manga, fetch details, and retrieve chapter/page data.

Extensions run in a **sandboxed QuickJS environment with no module system**. You cannot use `import`, `require`, or any Node.js built-ins. Two globals are injected by the app:

| Global | Type | Description |
|---|---|---|
| `globalThis.httpGet` | `async (url, options?) => HttpResponse` | Makes HTTP GET requests |
| `globalThis.ksoupSelect` | `(html, cssSelector) => KsoupElement[]` | Parses HTML with CSS selectors |

---

## Source file layout

The app only loads extensions found inside the `sources/` root folder. Two layouts are supported — pick whichever suits your workflow:

```
sources/
  mangakatana.js          # flat file — filename becomes the source ID
  mangadex/
    main.js               # folder layout — folder name becomes the source ID
```

Rules:
- Extensions **must** be plain `.js` files. TypeScript is not supported.
- Folder layout: the entry file inside the folder must be named exactly `main.js`.
- Flat layout: place the `.js` file directly under `sources/` with any name.

---

## Getting started

```bash
# 1. Clone this template
# 2. Install dev dependencies (only needed for local testing)
npm install

# 3. Rename sources/my-source/ (or create sources/mysource.js) for your source
# 4. Edit the extension file
# 5. Test locally (makes real HTTP requests to your source)
npm run local

# 6. Build for release (folder layout only — bundles dependencies into one file)
npm run build
# Output: sources/my-source/release.js
```

---

## File header

Every extension must begin with a JSDoc block that describes the source:

```js
/**
 * @name My Source Name        ← Display name shown in the app
 * @version 1.0                ← Increment on each release
 * @lang en                    ← Primary language of the source (ISO 639-1)
 * @iconUrl https://...        ← Direct URL to the source's favicon/icon
 */
```

---

## Required functions

All six functions must be assigned to `globalThis`. The app calls them by name.

### `getPopularManga(page)`
Returns currently popular/trending manga.

```js
// Returns:
[{
    title: string,
    url: string,        // full URL to the manga detail page
    coverUrl: string,
    status: string,     // e.g. "Ongoing", "Completed"
    description: string,
    author: string,
    artist: string,
    genres: string,     // comma-separated, e.g. "Action, Adventure"
}]
```

### `getLatestManga(page)`
Returns recently updated manga. Same return shape as `getPopularManga`.

### `searchManga(query, page)`
Searches for manga matching `query`. Same return shape as `getPopularManga`.

### `getMangaDetails(url)`
Returns full details for a single manga plus its chapter list.

```js
// Returns:
{
    manga: {
        title: string,
        url: string,
        coverUrl: string,
        status: string,
        description: string,
        author: string,
        artist: string,
        genres: string,
        lastUpdate: string,   // Unix timestamp as string, or ""
    },
    chapters: [{
        name: string,         // e.g. "Chapter 12: The Battle"
        url: string,
        number: number,       // parsed float, e.g. 12.0 — use -1.0 if unknown
        uploadDate: string,   // Unix timestamp as string, or ""
    }]
}
```

### `getChapterList(url)`
Returns the chapter list for a manga. If the chapter list is on the same page as the details, this can simply re-fetch and parse that page.

```js
// Returns: same chapter array shape as getMangaDetails
```

### `getPageList(url)`
Returns the ordered image URLs for a single chapter.

```js
// Returns:
["https://cdn.example.com/page1.jpg", "https://cdn.example.com/page2.jpg", ...]
```

---

## Using `ksoupSelect`

`ksoupSelect(html, selector)` returns an array of `KsoupElement` objects:

```js
const items = ksoupSelect(html, '.manga-list .item');

for (const item of items) {
    item.text       // visible text content
    item.outerHtml  // full element HTML — pass this to ksoupSelect again to drill in
    item.innerHtml  // inner HTML
    item.attr       // { "href": "...", "src": "...", ... }
}

// Drilling into a child element:
const titleEl = ksoupSelect(item.outerHtml, 'a.title')[0];
```

---

## Local testing

`local_runner.js` mocks `httpGet` (via axios) and `ksoupSelect` (via cheerio) and loads your `main.js` via `eval`. Uncomment the test blocks in `local_runner.js` to run individual functions against your live source.

If you rename `sources/my-source/`, update the `SOURCE_PATH` in `local_runner.js` and the paths in `package.json` to match.

---

## Tips

- All functions should return an empty array (or `null` for `getMangaDetails`) on error rather than throwing, so the app can handle failures gracefully.
- Page numbers are always 1-based.
- If a source has no pagination for popular manga, return an empty array for `page > 1`.
- If a search redirects to a single manga's detail page, detect this (e.g. via the response URL or a unique selector) and return that manga as a single-element array.
