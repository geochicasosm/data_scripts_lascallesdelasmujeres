# Pending Improvements

Detailed notes for a future session to continue improving this codebase.
Written after a thorough code review on 2026-03-30.

## Context

The data pipeline downloads street data from the Overpass API for a given city,
classifies streets by gender using local name dictionaries, then enriches female
street names with Wikipedia links. Recent changes added retry logic, caching,
server failover, and geometry optimization. This document captures remaining
improvements that were identified but not yet addressed.

---

## 1. Justfile: expose `--language` parameter

**Problem:** The Justfile `download_data` and `process` recipes only accept
`city` and `relationID`. Non-Spanish cities must drop down to `npm run` directly,
bypassing all the Justfile convenience.

**Fix:** Add an optional `language` parameter with a default value:

```just
download_data city relationID language='es': (create_dir city)
    npm run initial-step -- --city={{ city }} --relation={{ relationID }} --language={{ language }}
```

Apply the same pattern to `process`.

**Effort:** Small (< 5 minutes).

---

## 2. No timeout on Overpass API requests

**Problem:** If an Overpass server stops responding mid-request, the process
hangs forever. The retry logic in `retryWithBackoff` only handles *failures*,
not *hangs*.

**Fix:** `callOverpassAPI` now uses Node's built-in `https.request` directly
(see improvement #8, which is done). Adding a timeout is now trivial:

```javascript
req.setTimeout(60000, () => {
  req.destroy(new Error('Request timed out after 60s'));
});
```

Add this line inside `callOverpassAPI` after `transport.request(...)`.

**Effort:** ~5 minutes (was medium before we owned the HTTP layer).

---

## 3. `booleanContains` filtering is O(streets × boundaries)

**Problem:** In `processCity`, every street feature is tested against every
boundary polygon using `@turf/boolean-contains`. For a city with B boundary
polygons and S streets, this is O(S × B) expensive geometry operations.

**File:** `scripts/get-streets.js`, around the `filteredFeatures = features.filter(...)` block.

**Fix:** Add a bounding box pre-filter before the expensive geometry check:

```javascript
const bboxContains = require('@turf/bbox').default;

filteredFeatures = features.filter((feature) => {
  const featureBbox = bbox(feature);
  return optimizedBoundaries.features.find((boundary) => {
    // Quick bbox rejection test
    const boundaryBbox = bbox(boundary);
    if (featureBbox[0] > boundaryBbox[2] || featureBbox[2] < boundaryBbox[0] ||
        featureBbox[1] > boundaryBbox[3] || featureBbox[3] < boundaryBbox[1]) {
      return false;
    }
    try {
      return booleanContains(boundary, feature);
    } catch {
      return false;
    }
  });
});
```

For even better performance, consider `rbush` (R-tree spatial index) to index
the boundary polygons, but the bbox pre-filter alone should give a significant
speedup for large cities.

**Effort:** Medium (~30 minutes including testing).

---

## 4. Grid cache files not cleaned up after success

**Problem:** After `processCity` successfully writes `city_streets.geojson`,
the intermediate `grid_*.geojson` files remain on disk. These are only useful
for resuming interrupted downloads.

**File:** `scripts/get-streets.js`, end of `processCity`.

**Fix:** Add cleanup after the streets file is written:

```javascript
if (!cache.streets) {
  // ... existing filtering and writing code ...
  writeFeatures(filteredFeaturesPath, filteredFeatures);

  // Clean up intermediate grid files
  clearGridCache(city);
}
```

The `clearGridCache` function already exists and is exported. Just call it at
the right point. Consider adding a `--keep-grid-cache` flag if users want to
preserve them for debugging.

**Effort:** Small (< 5 minutes).

---

## 5. README flowchart inaccuracy

**Problem:** The Mermaid flowchart step G says "Clasificar géneros con API
genderize" but the code uses local dictionary matching against
`namesDB/list_mujeres.csv` and `namesDB/list_hombres.csv`. There is no external
API call to genderize.io.

**File:** `README.md`, the Mermaid flowchart section.

**Fix:** Change the node text from:
```
G[🏷️ Clasificar géneros\ncon API genderize]
```
to:
```
G[🏷️ Clasificar géneros\ncon diccionario local]
```

**Effort:** Trivial (< 2 minutes).

---

## 6. Modernize async patterns in `apply_gender.js`

**Problem:** `apply_gender.js` uses deeply nested callbacks: `fs.open` →
`fs.createWriteStream` → `fs.readFile` → `LineByLineReader` events → nested
`LineByLineReader` events. The `applyGender` function does not return a Promise
that resolves when work is complete (only in the cache-hit path). This means
`index.js` calling `await applyGender(...)` resolves immediately while actual
processing continues in detached callbacks.

This is the **root cause** of a real bug: if the process exits quickly after
`processCity` returns, gender classification may be incomplete.

**Current call chain:**
```
applyGender()
  → checkGenderizeCache() → returns Promise.resolve() [cache hit only]
  → prepareListCSV() → returns undefined [no Promise!]
    → fs.open callback
      → fs.readFile callback
        → initDictionaryObjects()
          → initWomenDic() via LineByLineReader
            → on('end') → initMenDic() via LineByLineReader
              → on('end') → startProcess()
                → new Promise (but it's never returned!)
```

**Fix approach:** Wrap the entire flow in a Promise that resolves in the final
`lr.on('end')` handler. This is a targeted fix that doesn't require rewriting
the whole file:

```javascript
function applyGender(folder, currentLangs = ['es']) {
  // ... existing setup code ...

  if (checkGenderizeCache()) {
    console.log('✅ Gender classification already completed');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Pass resolve/reject through the callback chain
    // so the final lr.on('end') in initReadFile calls resolve()
    prepareListCSV(resolve, reject);
  });
}
```

Then thread `resolve`/`reject` through `prepareListCSV` → `initDictionaryObjects`
→ `initWomenDic` → `initMenDic` → `startProcess` → `initReadFile`, and call
`resolve()` in the final `lr.on('end')` handler and `reject(err)` in any
`lr.on('error')` handler.

A **better long-term fix** is to convert the entire file to async/await using
`readline` (built-in) or `fs.promises`, but that's a larger rewrite.

**Effort:** Targeted Promise fix: ~30 minutes. Full async rewrite: ~2 hours.

---

## 7. Modernize `apply_wikipedia.js` to async/await

**Problem:** Same callback-based pattern as `apply_gender.js`. The
`LineByLineReader` event handlers make the code hard to follow and error-prone.
Since this file is a standalone script (not imported), the impact is lower than
`apply_gender.js`, but it would benefit from the same modernization.

**Effort:** ~1-2 hours.

---

## 8. ~~Replace `query-overpass` package~~ ✅ DONE (2026-05-14)

`query-overpass` removed. `callOverpassAPI` in `get-streets.js` now uses Node's
built-in `https` module directly, with `osmtogeojson` + `xmldom` for response
parsing. This also fixed the `overpass-api.de` 406 errors caused by the old
`request` library's User-Agent being blocked (see improvement #11).

---

## 9. Consider `rbush` spatial index for boundary filtering

**Problem:** Extension of improvement #3. For very large cities (e.g., Madrid,
Buenos Aires), even with bbox pre-filtering, the boundary containment check can
be slow if there are many boundary polygons.

**Fix:** Use `rbush` to build an R-tree index of boundary polygon bboxes, then
query it for each street feature. Only run `booleanContains` on the candidates
returned by the spatial index.

**Effort:** Medium (~1 hour). Only worth doing if cities with 10+ boundary
polygons are common.

---

## 10. Error handling in `apply_wikipedia.js` line flow

**Problem:** In `initReadFile`, the line handler has a logic issue inherited from
the original code. The male and female cases use `else if`, but the unknown case
was a bare `if` (fixed to `else if` in the recent review). However, the `else`
at the end (`lr.resume()`) only pairs with the unknown case, not the male/female
cases. This means if a line doesn't match any condition (e.g., already in
`streetMap`), `lr.resume()` is called from the `else` branch, which is correct
but fragile.

A cleaner approach would restructure the handler:

```javascript
lr.on('line', function (line) {
  lr.pause();
  const splitLine = line.split(';');

  if (streetMap.has(splitLine[COL_FULL_NAME])) {
    lr.resume();
    return;
  }

  const gender = splitLine[COL_GENDER].toLowerCase();
  streetMap.add(splitLine[COL_FULL_NAME]);

  if (gender === MALE) {
    stream.write(line + '\n');
  } else if (gender === FEMALE) {
    const result = myfuse.search(splitLine[COL_CLEAN_NAME]);
    const url = result.length > 0 && result[0]?.item?.sitelink
      ? result[0].item.sitelink
      : '';
    stream.write(line + ';' + url + '\n');
  } else if (keepUnknown && gender === UNKNOWN) {
    stream.write(line + '\n');
  }

  lr.resume();
});
```

**Effort:** Small (~15 minutes).

---

## 11. `overpass-api.de` User-Agent requirement

**Context (2026-05-14):** `overpass-api.de` started returning HTTP 406 for
requests without a recognized User-Agent. The old `request` library (used by
`query-overpass`) sent `node-request/x.x.x` which is now blocked.

**Fix applied:** `callOverpassAPI` (part of #8 replacement) sends:
```
User-Agent: LasCallesDeLasMujeres/1.0 (https://github.com/geochicasosm/lascallesdelasmujeres)
```

Also fixed: 406 now triggers server failover in `retryWithBackoff` (previously
only 429/502/503/504 did). Added `overpass.kumi.systems` as an independent
failover server (the three previous servers were all `overpass-api.de`
infrastructure, so a network-level block hit all three).

Inter-request delays also reduced: 15s→10s (large grid), 10s→5s (small grid).

**Status:** Done. No further action needed.

---

## Priority Order

Based on impact and effort:

1. **#6 (applyGender Promise)** — Real bug causing potential data loss. Medium effort.
2. **#2 (Timeouts)** — Now ~5 min since we own the HTTP layer. Prevents hangs.
3. **#5 (README fix)** — Trivial fix, improves accuracy.
4. **#1 (Justfile language)** — Small fix, improves usability.
5. **#4 (Grid cleanup)** — Small fix, saves disk space.
6. **#3 (bbox pre-filter)** — Medium effort, big perf win for large cities.
7. **#10 (Wikipedia handler)** — Small effort, improves correctness.
8. **#7 (Modernize apply_wikipedia)** — Nice-to-have cleanup.
9. **#9 (rbush)** — Only if large cities are a bottleneck.
