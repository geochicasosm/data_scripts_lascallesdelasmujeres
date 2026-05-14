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

## 1. ~~Justfile: expose `--language` parameter~~ ✅ DONE (2026-05-14)

`download_data` and `process` now accept an optional `language='es'` parameter.
Usage: `just process city relationID fr`

---

## 2. ~~No timeout on Overpass API requests~~ ✅ DONE (2026-05-14)

`callOverpassAPI` now sets a 60s timeout via `req.setTimeout`. On timeout,
`req.destroy(new Error(...))` fires, which triggers `req.on('error')` → reject
→ `retryWithBackoff` retries on the next server.

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

## 4. ~~Grid cache files not cleaned up after success~~ ✅ DONE (2026-05-14)

`clearGridCache(city)` now called immediately after `writeFeatures` in `processCity`.

---

## 5. ~~README flowchart inaccuracy~~ ✅ DONE (2026-05-14)

Mermaid node G updated: `con API genderize` → `con diccionario local`.

---

## 6. ~~Modernize async patterns in `apply_gender.js`~~ ✅ DONE (prior commit 1737865)

`applyGender` already returns a proper Promise wrapping the full callback chain.
`prepareListCSV` → `runClassification().then(resolve, reject)` → `classifyStreets`
resolves in `lr.on('end')`. Both error paths call `reject`. The bug described
here was fixed before this document was written.

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

## 10. ~~Error handling in `apply_wikipedia.js` line flow~~ ✅ DONE (2026-05-14)

`initReadFile` line handler restructured: early-return on duplicate, single
`lr.resume()` at end, `streetMap.add` before branching so all paths are handled.

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

1. **#3 (bbox pre-filter)** — Medium effort, big perf win for large cities.
2. **#7 (Modernize apply_wikipedia)** — Nice-to-have cleanup.
3. **#9 (rbush)** — Only if large cities are a bottleneck.
