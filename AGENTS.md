# Agent Guide

## What this project does

Node.js pipeline that downloads OpenStreetMap street data for a city, classifies
street names by gender using local dictionaries, and enriches female street names
with Wikipedia links. Output is a set of CSV/GeoJSON files consumed by the
[Las Calles de las Mujeres](https://geochicas.org) map project.

## Running things

Use `just` (Justfile) for all common tasks. `npm run` works too but bypasses
Justfile guards.

```bash
just download_data <city> <OSM-relation-id>          # download + classify
just download_data <city> <OSM-relation-id> <lang>   # non-Spanish city (default: es)
just wikipedia <city>                                 # enrich with Wikipedia URLs
just process <city> <OSM-relation-id>                # download + wikipedia + tar
just postprocess <city>                              # final GeoJSON for publishing
just clear_cache <city>                              # wipe all cached data
just clear_grid_cache <city>                         # wipe only intermediate grids
just cache_status <city>                             # inspect what's cached
```

## Directory structure

```
scripts/          main pipeline scripts
  index.js        entry point for download+classify step
  get-streets.js  Overpass API fetch, caching, boundary filtering
  apply_gender.js gender classification against local dictionaries
  apply_wikipedia.js  Wikipedia URL enrichment
  overpass-servers.js  Overpass server list and failover config
  filters.js      street name prefix/suffix filters per language
  commons.js      shared file utilities
namesDB/          local gender dictionaries (CSV, one name per line)
  list_mujeres.csv
  list_hombres.csv
data/<city>/      generated files (gitignored)
  <city>_boundary.geojson
  <city>_streets.geojson
  grid_*.geojson  intermediate per-grid cache (auto-deleted on success)
  list.csv
  list_genderize.csv
  list_genderize_wikipedia.csv
wikipedia/        pre-built Wikipedia name→URL lookup tables (JS modules)
```

## Code conventions

- ES5/CommonJS (`require`/`module.exports`). No transpilation.
- ESLint runs automatically on commit (husky pre-commit hook with `--fix`).
  Run manually: `npm run lint`.
- Async code: use `async/await` and `Promise`. Avoid raw callbacks in new code.
- File I/O for line-by-line reading: use Node built-in `readline` with
  `for await...of`, not the `line-by-line` npm package.
- No test suite. Validate changes by running `just download_data` on a small city.

## Overpass API

- All requests go through `callOverpassAPI` in `scripts/get-streets.js`.
- User-Agent header is required — `overpass-api.de` returns 406 without it.
- Retry logic with server failover lives in `retryWithBackoff` (3 attempts, 60s timeout).
- Available servers configured in `scripts/overpass-servers.js`. Prefer adding
  servers there rather than hardcoding URLs elsewhere.
- Inter-request delay: 5s (small grid) / 10s (large grid) / 30s after rate-limit.

## Caching

- Boundary and streets GeoJSON are cached in `data/<city>/`. Re-runs skip
  already-downloaded steps automatically.
- Grid files (`grid_*.geojson`) cache in-progress street downloads so interrupted
  runs resume instead of restarting. Deleted automatically on success.
- Delete `data/<city>/` to force a full re-download.

## Key pitfalls

- `data/` is gitignored — never commit city data files.
- `wikipedia/` contains large pre-built JS lookup tables. Do not regenerate
  unless intentional; takes significant time and external lookups.
- The `language` parameter affects street name prefix stripping (`filters.js`).
  Wrong language = poor gender classification results.
- `list_genderize.csv` is the handoff between the download and wikipedia steps.
  If it's missing or empty, the wikipedia step will fail with a clear error.
