# Mangasteen Source Extension Template

A starting point for writing source extensions for the **Mangasteen** manga reader app (Android/iOS, built with KMP).

## What is a source extension?

An extension implements the parsing logic for a specific manga website. The Mangasteen app embeds **[QuickJS](https://bellard.org/quickjs/)** — a small, embeddable JavaScript engine — that loads your extension at runtime and calls its functions to search for manga, fetch details, and retrieve chapter/page data.

Extensions run in a **sandboxed QuickJS VM** with no module system. You cannot use `import`, `require`, or any Node.js built-ins. The host injects a small set of globals (`httpGet`, `ksoupSelect`, `crypto`, `console.log`, `clearCookies`) — everything your source needs to fetch HTML, parse it, and return typed results.

---

## Source file layout

The app only loads extensions found inside the `sources/` root folder. Two layouts are supported:

```
sources/
  mangakatana.js          # flat file — filename becomes the source ID
  mangadex/
    main.js               # folder layout — folder name becomes the source ID
    extension.json        # manifest (strongly recommended)
    icon.png              # optional bundled icon (referenced from manifest)
    main.js.sig           # optional Ed25519 signature over main.js
```

Rules:
- Extensions **must** be plain `.js` files. TypeScript is not supported at runtime, but you can use `host-globals.d.ts` for autocomplete.
- Folder layout: the entry file must be named exactly `main.js`.
- Flat layout: place the `.js` file directly under `sources/` with any name.
- Flat files rely on the JSDoc header (see below). For anything non-trivial — signing, capabilities, rate limits — use the folder layout with an `extension.json`.

---

## The manifest (`extension.json`)

Preferred over the JSDoc header. Every field in the folder layout is read from `extension.json`; JSDoc is only consulted for flat files (and as a fallback if no manifest is present).

```json
{
  "name": "My Source Name",
  "version": "1.0",
  "lang": "en",
  "iconUrl": "https://example.com/favicon.png",
  "icon": "icon.png",
  "apiVersion": 1,
  "hostAllowlist": ["example.com", ".cdn.example.com"],
  "capabilities": ["cookies"],
  "nsfw": false,
  "maxRequestsPerSecond": 2,
  "cachePolicy": {
    "getPopularManga": 300,
    "getLatestManga": 120,
    "getChapterList": 600
  }
}
```

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Display name shown in the app |
| `version` | string | Bump on every release — the host uses it to detect updates |
| `lang` | string | ISO 639-1 language code |
| `iconUrl` | string | Remote icon URL (fallback when `icon` is absent) |
| `icon` | string? | Relative path to a bundled icon asset; the host downloads it once and caches it locally |
| `apiVersion` | int | Contract version you're targeting. Current supported value: `1`. Sources outside the supported range are rejected. |
| `hostAllowlist` | string[] | Hostnames (or `.suffix` wildcards) the host will let `httpGet` call. Empty = trust-mode (no enforcement). **Strongly recommended.** |
| `capabilities` | string[] | Free-form feature flags the UI surfaces at install time. Known values: `"cookies"` (uses persistent cookie jar), `"descrambler"` (emits `#descrambler=…` page URL fragments). |
| `nsfw` | bool | Content rating; the UI may gate access behind a setting |
| `maxRequestsPerSecond` | int? | Host-side token-bucket rate limit applied to every `httpGet`. Omit or set `null` for no limit. |
| `cachePolicy` | map<string,int> | Per-function response TTL in seconds. Keys are function names (`getPopularManga`, `getLatestManga`, `searchManga`, `getMangaDetails`, `getChapterList`, `getPageList`). Functions not listed are not cached. |

### JSDoc fallback

For flat-file sources (or folder-layout sources without an `extension.json`), the host scrapes a JSDoc block at the top of `main.js`:

```js
/**
 * @name My Source Name
 * @version 1.0
 * @lang en
 * @iconUrl https://example.com/favicon.png
 */
```

Only `name`, `version`, `lang`, and `iconUrl` are parsed from JSDoc — everything else defaults. Use the manifest if you need any of the advanced fields.

---

## Getting started

```bash
# 1. Clone this template
# 2. Install dev dependencies (only needed for local testing + type-checking)
npm install

# 3. Rename sources/my-source/ for your source, edit extension.json + main.js
# 4. Test locally (real HTTP requests to your source)
npm run local

# 5. Run against recorded fixtures (no network)
npm run test

# 6. Type-check against the host contract
npm run typecheck

# 7. Build for release (folder layout only — bundles imports into one main.js)
npm run build
```

The bundled `release.js` is what you publish; the host loads it as `main.js` inside the folder (adjust your repo layout or the bundler output path accordingly).

---

## Host globals

The host injects everything below into the QuickJS global scope. The canonical reference with types is [`host-globals.d.ts`](./sources/my-source/host-globals.d.ts) — include it via `tsconfig.json` for autocomplete.

### HTTP

```ts
declare function httpGet(url: string, options?: {
  method?: string;               // default: "GET"
  headers?: Record<string, string>;
  params?: Record<string, string>;   // appended as querystring
  body?: string;                 // raw body for non-GET methods
}): Promise<{
  body: string;                  // response body
  url: string;                   // final URL after redirects
  status: number;
}>;
```

- Cookies are auto-persisted per source. Don't set `Cookie` manually unless you want to bypass the jar.
- `httpGet` enforces both `hostAllowlist` and `maxRequestsPerSecond` from the manifest.
- On network / HTTP errors the promise rejects; let it propagate so the host can record a health event and trip the circuit breaker on repeated failures.

```ts
declare function clearCookies(): Promise<void>;
```

Wipes this source's cookie jar. Use in a login/logout path or when recovering from a broken session.

### HTML parsing

```ts
declare function ksoupSelect(html: string, selector: string): Array<{
  text: string;
  outerHtml: string;
  innerHtml: string;
  attr: Record<string, string>;
}>;
```

Standard CSS selector syntax via [ksoup](https://github.com/fleeksoft/ksoup). Drill into children by feeding `outerHtml` back into `ksoupSelect`:

```js
const cards = ksoupSelect(html, ".manga-card");
for (const card of cards) {
  const title = ksoupSelect(card.outerHtml, "a.title")[0]?.text;
  const href = ksoupSelect(card.outerHtml, "a.title")[0]?.attr.href;
}
```

### Crypto

```ts
declare const crypto: {
  sha1(input: string): string;                                 // hex digest
  sha256(input: string): string;
  sha512(input: string): string;
  hmacSha256(keyHex: string, message: string): string;         // hex key
  hmacSha256FromUtf8(key: string, message: string): string;    // utf-8 key
  base64Encode(input: string): string;
  base64Decode(input: string): string;                         // → utf-8
  aesCbcDecrypt(
    keyHex: string,
    ivHex: string,
    base64Cipher: string,
    padding?: "pkcs7" | "none",
  ): string;                                                   // → utf-8 plaintext
};
```

String in, string out. Hash outputs are lowercase hex. `aesCbcDecrypt` uses PKCS7 padding by default and runs natively (javax.crypto / CommonCrypto) — substantially faster than any pure-JS implementation on real chapter payloads. Pass `"none"` as the fourth argument for sources that zero-pad (or otherwise don't use PKCS7); strip the sentinel bytes yourself in JS.

**Policy.** The host exposes cryptographic *primitives* only. Higher-level libraries (HTML/JS deobfuscators, protobuf, site-specific helpers) stay in user-space — bundle them with esbuild. The surface above is what you get; anything else you need, ship it in your extension.

### Console

```ts
declare const console: {
  log(...args: unknown[]): void;
};
```

Prefixed with the source name in the host's log. Use sparingly — every call crosses the JS↔native boundary.

---

## Required functions

Assign each to `globalThis`. All are async. The host calls them by name; missing or non-function values fail the source at install time.

### `getPopularManga(page: number): Promise<Manga[]>`
Trending / popular listings. Called starting at `page = 1`. Return `[]` when you've run out of pages.

### `getLatestManga(page: number): Promise<Manga[]>`
Recently updated listings. Same shape.

### `searchManga(query: string, page: number): Promise<Manga[]>`
Query search. Same shape. If a search redirects to a single manga detail page, detect it and return a one-element array.

### `getMangaDetails(url: string): Promise<MangaWithChapters | null>`
Full metadata plus (optionally) the chapter list in one fetch.

```ts
type MangaWithChapters = {
  manga: {
    title: string;
    url: string;
    coverUrl?: string;
    status?: string;
    description?: string;
    author?: string;
    artist?: string;
    genres?: string[];        // array of genre names
    lastUpdate?: number;      // Unix epoch ms; 0 when unknown (number or numeric string)
  };
  chapters: Array<{           // may be empty if your site serves them separately
    name: string;
    url: string;
    number: number;           // float; use -1 for "unknown"
    uploadDate: number;       // Unix epoch ms; 0 when unknown
  }>;
};
```

Return `null` on failure so the host can distinguish "manga not found" from a genuine parse error.

### `getChapterList(url: string): Promise<Chapter[]>`
Chapter list for a manga. If `getMangaDetails` already included the list, this can re-fetch and re-parse the same URL (or just call back into a shared helper).

### `getPageList(url: string): Promise<string[]>`
Ordered image URLs for one chapter.

```js
[
  "https://cdn.example.com/page1.jpg",
  "https://cdn.example.com/page2.jpg",
  // For sources that need client-side descrambling, append a fragment the host recognises:
  "https://cdn.example.com/scrambled.jpg#descrambler=mangago&key=abc123"
]
```

If you emit descrambler fragments, add `"descrambler"` to `capabilities` so the UI knows.

---

## Signing (optional but recommended)

Sources can be Ed25519-signed so the host can verify nothing's been tampered with between the repo and the app.

1. Publish your public key as `publickey.pem` at the **repo root** (PEM-armored or a raw 32-byte Ed25519 key).
2. For each source, sign the bytes of `main.js` with the matching private key and drop the result at `sources/<source>/main.js.sig` (base64 or raw).

On add, the host fetches your public key once and stores it on the repo entity (TOFU — trust on first use). Subsequent syncs verify every signed source against that cached key.

- Sources without a `.sig` install as `"Signature unverified"` but still work (unless your users have toggled strict mode).
- Sources whose signatures don't match are **rejected**; the repo shows a sync error.
- Rotating `publickey.pem` at the same URL will force re-verification on next sync — existing sources that can't verify against the new key fail.

---

## Runtime guarantees and quirks

- **Host allowlist enforcement.** A non-empty `hostAllowlist` is a firewall, not a hint: `httpGet` throws if you try to call any host outside it. Use suffix wildcards (`.cdn.example.com`) for CDN fan-out.
- **Rate limiting.** `maxRequestsPerSecond` is a token bucket with burst capacity equal to the rate — it smooths spikes without blocking infrequent calls. Failures count against a circuit breaker on the host; 5 consecutive failures inside a 10-minute window pauses the source for 60 s.
- **Response caching.** `cachePolicy` entries cache by a hash of the arguments. `searchManga` keys on `"${query}|${page}"`; the per-chapter/per-manga functions key on `url`. Caches are in-memory only and cleared on app restart.
- **No persistent storage.** Use cookies for per-session state; don't try to write files.
- **No timers.** `setTimeout`/`setInterval` are not provided. Structure your code as async/await pipelines.
- **Errors propagate.** Throw from any of the six entry points to signal a parse failure — don't silently return `[]`; the host needs to know so it can back off. `getMangaDetails` is the one exception (return `null` for "not found").

---

## Local testing

`local_runner.js` shims `httpGet`, `ksoupSelect`, and `crypto` with axios + cheerio + node:crypto and loads your `main.js` via `eval`. Uncomment the function blocks to exercise each entry point.

- `npm run local` — hits the live site.
- `npm run test` — replays recorded fixtures under `sources/my-source/fixtures/`, no network.
- `npm run typecheck` — type-checks `main.js` against `host-globals.d.ts` via TypeScript (JSDoc-typed). Catches missing return fields and mistyped globals before the app ever sees your code.

If you rename the source folder, update `SOURCE_PATH` in `local_runner.js` and the path in `package.json`'s `build` script.

---

## Tips

- Page numbers are 1-based. Return `[]` for pages beyond your last.
- `uploadDate` and `lastUpdate` are Unix **milliseconds**. Return a JS number (preferred) or a numeric string. Use `0` when unknown — empty strings fail deserialization and drop the whole chapter/manga.
- `genres` is a string array. Returning a comma-separated string still works for legacy extensions but new sources should use the array form.
- If your site gates content behind age confirmation or regional blocks, bake the workaround into `httpGet` headers rather than asking users to configure it.
- Keep `capabilities` honest — the app uses it to decide whether to surface cookie-clearing UI, descrambler paths, etc.
- Bump `version` on every release. The host uses it to detect updates and show users what changed.
