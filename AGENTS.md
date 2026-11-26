## 1. Purpose

### Project Summary
A high-performance, vanilla-web dashboard for managing community icon requests for Monocons. It turns static JSON/XML datasets into an interactive triage tool: browse and filter requests, inspect priority/popularity/domain/activity stats, plan contributions, cross-reference Lawnicons links, review SVG quality, browse community home screens, and export bundles for contributors.

### Scope
Included:
- Infinite scrolling / lazy rendering (`CONFIG.ui.batchSize = 500`) for datasets exceeding 10k items, plus staggered scroll loading for split `links` filter batches.
- Deep-linking via URL parameters for shared filter, view, sort, and tool-page states.
- Client-side ZIP generation with `appfilter.xml`, `icontool_commands.txt`, `filter_config.json`, and source icons.
- Material Design 3 (M3) inspired UI with keyboard navigation and accessible menus/tooltips.
- Local Python scripts for data enrichment (Play Store metadata for requests and links), pruning, tagging (`in_lawnicons`, `links`), and build-time QA.
- Local, lazily loaded `fflate` for ZIP compression.

Excluded (non-goals):
- Server-side state or user databases. The dashboard remains strictly static.
- Framework-specific implementations (React, Vue, etc.).
- Direct file system writes from the browser.
- Node.js build tooling for the dashboard itself.

## 2. System Architecture

### Tech Stack
- **Languages:** JavaScript (ESNext), CSS3 (Modern), HTML5, Python 3.10+ (scripts).
- **Frameworks:** None (vanilla JS modules are plain script files, not ES modules).
- **Runtime:** Browser-based; deploy as static files (Vercel).
- **Type checking:** `// @ts-check` in `src/script.js`, JSDoc, global declarations in `src/types.d.ts`, config in `deno.json` (`allowJs`/`checkJs`).
- **Compression library:** Vendored `src/fflate.umd.js`, loaded on first export via `loadFflate()`. There is no CDN script tag in `src/index.html`.
- **Server-side validation:** none; run locally with any static server, e.g. `python3 -m http.server 8765 --directory src`.

### High-Level Structure
- **Bootstrap:** `src/index.html` loads `lint_icons.js` and `script.js`. `Data.init()` runs immediately; `UI.init()` performs the first render.
- **Data Layer:** `App.data` holds `requests.json` apps alongside link-only synthetic `AppEntry` items merged from `links_*.json`. Auxiliary datasets are split into critical, deferred, and on-demand/scroll-loaded phases (see below).
- **State Layer:** Runtime state is centralized in `App.state` with lookup maps (`idMap`, `appTags`, `filterMetadata`, `existingSvgs`), derived indices (`_geoPrefixById`, `_issueByComponent`), dual appfilters (`existingIcons` and `lawniconsIcons`), staggered `links` pagination state (`linksBatchIndex`, `linksTotalBatches`, `linksLoading`), analytics tables, and URL-backed UI mode.
- **Namespace Layer:** Top-level objects: `App`, `Utils`, `Templates`, `Components`, `Actions`, `Data`, `UI`. `Components` contains `Toast` and `Tooltip`. `Heuristics` is currently a placeholder.
- **Event Layer:** Document-level delegation, targeted control listeners, popover/context-menu handlers, `IntersectionObserver` for infinite scroll (and staggered `links_*` batch fetching), and keyboard navigation handlers.
- **Data flow:** JSON/XML → `Data.init()` → `App.state` maps/indices → `Data.process()` → `UI.render()` / `UI.loadMore()` → `Templates` / DOM.

### Loading Phases
- **Critical (before first render):** `requests.json`, `assets/filters/*.json` (`links` initially fetches `links_requested.json` + `links_1.json`), `assets/stats/sets_stats.json`, `domain_stats.json`, `activity_stats.json`, then `idMap`, `appTags`, `filterMetadata`, and synthetic `isLinkOnly` entries from initial `links` batches.
- **URL resolution:** `Data.loadUrlState()` runs before any render. If the URL genuinely needs graphs (`regex` with text, `q=scr-N`, `q=#N`, `view=screens`, `tab=homescreens`), `Data.loadGraphData()` is awaited before `UI.init()`.
- **First paint:** `UI.init()` renders the first batch immediately after critical data (and required graphs) are ready.
- **Deferred:** scheduled after the first frame via `requestIdleCallback` (fallback `setTimeout`): graph datasets (`loadGraphData()`), optional stats (`fulfillment_history.json`, `trending_baseline.json`), review issues, and dual appfilters (`assets/appfilter.xml` and `assets/lawnicons_appfilter.xml`, followed by `Data.resolveLinkedComponents()`). A single `UI.refreshAfterDeferredData()` updates cards/badges and re-renders while preserving `renderedCount` and scroll position.
- **On demand / Staggered scroll:** `excluded_packages.json` is fetched and memoized by `Data.getDynamicMatches()`. Remaining `links` batches (`assets/filters/links_2.json` … `links_N.json`) are loaded lazily on scroll via `UI.handleLinksScrollLoad()` → `Data.loadNextLinksBatch()` when the `links` filter or text search is active. Failures in optional datasets are non-fatal.

### Data Files
- `assets/requests.json`: primary flat app dataset (with optional `roi_score` and `priority`).
- `assets/filters/{supported,redesign,easy,foss,nameinuse,match,stale,in_lawnicons}.json`: filter membership + metadata. `plan` is synthesized in code and persisted in `localStorage`; `unlabeled` is computed at runtime (`!app.isLinkOnly`). A `plan.json` 404 is expected.
- `assets/filters/links_requested.json` and `assets/filters/links_1.json` … `links_N.json`: `links` filter datasets for apps supported in Monocons with extra Lawnicons components, split into batches of 50 sorted by linked component count (requested apps separated into `links_requested.json`) and enriched with Play Store `installs` via `scripts/dump_play_info_links.py`.
- `assets/requests_graph.json`: component → neighboring components (geo regex/screen matching).
- `assets/screens_graph.json`: screen ID (`scr-N`) → component list.
- `assets/supported_issues.json`: GitHub issue key (`#N`) → component list.
- `assets/home_screens/entries.json` and `images/*.webp`: home-screen cards.
- `assets/appfilter.xml`: canonical Monocons existing icon list (`ComponentInfo{...}` items).
- `assets/lawnicons_appfilter.xml`: upstream Lawnicons appfilter used alongside `appfilter.xml` to populate `lawniconsIcons` and resolve/copy linked components for `in_lawnicons` and `links`.
- `assets/excluded_packages.json`: `dynamic` and `dead` package lists for dynamic-match commands.
- `assets/stats/sets_stats.json`: popularity overrides for sorting.
- `assets/stats/domain_stats.json`: domain breakdown card, tooltip, `_population`.
- `assets/stats/activity_stats.json`: activity card.
- `assets/stats/fulfillment_history.json`: icons/day and supported/day for the activity card.
- `assets/stats/trending_baseline.json`: `trending` sort deltas.
- `assets/qa_issues/review_issues.json`: low-quality badge and QA page.
- `assets/qa_issues/review_pass.json`, `assets/qa_issues/svgs/`: build-time QA data and Monocons SVGs (SVGs are also rendered for `existing_drawable` and library previews).
- `assets/dead_links.json`: build-time input for `scripts/dump_play_info.py` and `scripts/dump_play_info_links.py`, not fetched by the dashboard.
- `assets/stats/creation_odds.json`: legacy analytics file on disk, unused by the dashboard runtime.

### `requests.json` Structure
`firstAppearance` and `lastRequested` are Unix timestamps in seconds; `installs` is a string with commas and a plus sign (e.g., `"100,000,000+"`). Optional ROI/impact fields are `roi_score` (numeric ranking priority) and `priority` (`"Critical"`, `"High"`, `"Medium"`, `"Low"`, omitted when `roi_score` is 0).

```json
{
  "count": 1,
  "lastUpdate": "2026-01-01",
  "apps": [
    {
      "drawable": "drawable_in_snake_case",
      "requestCount": 100,
      "firstAppearance": 1767196800.0,
      "lastRequested": 1767196800.0,
      "label": "App Title",
      "componentName": "com.example/com.example.MainActivity",
      "installs": "100,000,000+",
      "roi_score": 5390,
      "priority": "Critical"
    }
  ]
}
```

### Filter Dataset Shape
Each filter file is an object with `label`, `description`, and an array under the filter ID (or `"links"` in `links_requested.json` / `links_<n>.json`, which also include `batch` and `total_batches`). Entries may be component-name strings or metadata objects (`id`, `existing_drawable`, `lawnicons_drawable`, `name`, `drawable`, `installs`, `components`):

```json
{
  "label": "Example",
  "description": "Example filter",
  "example": [
    "com.example/com.example.MainActivity",
    { "id": "com.a/com.a.Main", "existing_drawable": "existing_icon" },
    { "id": "com.b/com.b.Main", "lawnicons_drawable": "lawnicons_icon" }
  ]
}
```

`App.state.existingSvgs` is populated from `existing_drawable` metadata (local Monocons SVGs in `assets/qa_issues/svgs/`). Items in `links_*.json` that are absent from `requests.json` are synthesized into `AppEntry` records with `isLinkOnly: true` and `components: [...]`; `Data.filterApps()` hides `isLinkOnly` rows unless the `links` filter or a text search is active. `App.state.appTags` is the canonical tag lookup used by `Data.process()`.

### `appfilter.xml` Structure
```xml
<!-- Note: Generated exports omit the <resources> wrapper for easy appending -->
<resources>
  <item component="ComponentInfo{COMPONENT_NAME}" drawable="ICON_NAME" name="APP_NAME" />
  <!-- Example -->
  <item component="ComponentInfo{k4ustu3h.monocons/k4ustu3h.monocons.MainActivity}" drawable="monocons" name="Monocons" />
</resources>
```

### URL State
`Data.loadUrlState()` / `Data.syncUrlState()` are the only places that read/write these parameters:

| Parameter | Meaning |
| --- | --- |
| `q` | Search text, regex, `scr-N`, or `#N` query |
| `view` | `list` (default), `grid`, or `screens` |
| `sort` | Any key from `UI.sortOptions` (including `roi-desc` / `roi-asc`); screens view uses `UI.screenSortOptions` |
| `regex` | `1` enables regex mode |
| `filters` | Comma-separated active filter IDs |
| `page` | `low-quality-icons`, `contribution-plan`, `icon-review` |
| `tab` | `requests` (default) or `homescreens` |

There is no `geo` URL parameter. Geo information is derived from `requests_graph` into `App.state._geoPrefixById` and shown as row prefixes; there is no separate geo-batch mode.

### UI Modes
- **Main tabs:** `requests` and `homescreens`. `view=screens` also selects the screens presentation.
- **Views:** `list`, `grid`, `screens` (separate `screenSort` state).
- **Tool pages:** low-quality QA, contribution plan, icon review. These replace the main content; `page` records the active one.
- **Contribution plan:** stored in `localStorage` keys `monocons_contribution`, `monocons_contribution_overrides`, `monocons_contribution_active`; entries receive the `plan` tag.
- **Bundle action mode:** `App.state.actionMode` is `new` (include `_icons/` in ZIP) or `link` (metadata only).
- **Icon review:** uses the browser port `src/lint_icons.js` (rules C01, C07, C10, C11, O01 for 192×192 monochrome SVGs) and allows importing an `appfilter.xml`.

### Dependency Rules
Allowed:
- Small, single-purpose local utilities (currently vendored `fflate`).
- Local static assets and Python scripts for data generation.

Forbidden:
- UI frameworks (React/Vue/Angular).
- CSS-in-JS libraries.
- Node.js build-time requirements for the dashboard.
- Loading critical app logic from a CDN.

## 3. Invariants (Must Never Break)

Functional:
- URL parameters are the source of truth on page load for `q`, `view`, `sort`, `regex`, `filters`, `page`, and `tab`.
- `App.state.selected` (keyed by `componentName`) must persist through search, filter, sort, view, tool-page changes, staggered `links_*` loads, and the deferred-data refresh.
- Regex mode, special queries (`scr-N`, `#N`), and screens/home-screen deep links must wait for their graph data before the first render; other URLs must not wait.
- Invalid regex input must degrade safely to zero results, not crash the app.
- Optional-data fetch failures must be non-fatal and leave usable defaults in `App.state`.
- When copying appfilter entries (`Actions.generateAppFilterXml()`) for apps in Lawnicons (`in_lawnicons` or `links`), all matching components from both `existingIcons` (`assets/appfilter.xml`) and `lawniconsIcons` (`assets/lawnicons_appfilter.xml`), plus resolved `app.components`, must be included and deduplicated rather than copying only the primary component.
- Staggered `links` batch loading (`UI.handleLinksScrollLoad()` / `Data.loadNextLinksBatch()`) must deduplicate against existing entries across `App.state.idMap`, `Data.process()` (`seenComps`), `UI.handleLinksScrollLoad()` (`currentData`), and `UI.loadMore()` (`App.state.renderedIds`) so items in both `requests.json` and `links_*.json` never render twice.
- Link-only entries (`isLinkOnly`) remain hidden when neither `links` filter nor text search is active, and display their linked component count in the Requests column (`Templates.listRow()`).

Export correctness:
- `Actions.downloadBundle()` produces `appfilter.xml`, `filter_config.json` (selection flow only), `icontool_commands.txt`, and optionally `_icons/` for `new` mode (`monocons-add-icons-MM-DD.zip` / `monocons-link-app-ids-MM-DD.zip`).
- `Actions.downloadContributionBundle()` produces `appfilter.xml`, `icontool_commands.txt`, and optionally `_icons/` (`monocons-contribution-MM-DD.zip`); it does **not** contain `filter_config.json`.
- There is no `pr_description.md` file in either ZIP.
- Every filename in `_icons/` must match the `drawable` written to `appfilter.xml` and `icontool_commands.txt`.
- In `downloadBundle()`, drawables are assigned deterministically per `componentName`; a different component with a colliding name receives stable `_2`, `_3`, … suffixes. Both ZIP flows emit items/commands for all resolved `app.components` when present, and contribution mode respects user-edited label/drawable overrides.

Architectural:
- String HTML fragments live in `Templates`; direct DOM creation is acceptable for small controls, observers, tooltips, and focus plumbing.
- Incremental rendering builds one HTML string per batch, parses it once, and appends through a `DocumentFragment` (`UI.loadMore()`).
- `App.state.idMap` keeps O(1) lookup for all loaded apps (including link-only entries and linked component aliases).
- `App.state.appTags`, `filterMetadata`, `existingSvgs`, `existingIcons`, `lawniconsIcons`, `_geoPrefixById`, `_issueByComponent`, and analytics maps are the canonical lookup sources after initialization.
- Deferred datasets trigger exactly one coordinated refresh (`UI.refreshAfterDeferredData()`), never separate per-dataset re-renders.

Performance:
- Target: first meaningful paint from critical data only; heavy graphs/XML and later `links_2+` batches must not block the common path.
- Critical hot paths: `Data.process()` (filter/dedup/sort loop), `UI.loadMore()` (batch rendering), `Data.getDynamicMatches()` (memoized commands).
- `loadFflate()` is awaited only inside export functions.

## 4. Modification Protocol

1. **Identify:** Build-time (Python/data generation) or runtime (JS/UI/export) work.
2. **State:** Update `App.state` and its default initialization when the runtime data shape changes; add matching JSDoc in `src/script.js` and declarations in `src/types.d.ts`.
3. **Loading phase:** Decide whether a new dataset is critical, graph-required by a deep link, deferred, scroll-staggered (`links_*`), or on demand. Add it to the corresponding `Data.init()` phase and to `UI.refreshAfterDeferredData()` if it affects rendered UI.
4. **URL Sync:** If behavior is deep-linkable, update both `Data.loadUrlState()` and `Data.syncUrlState()`, plus `needsGraphData` if graphs are required.
5. **Processing Path:** If search, tags, sort, or special queries change, update `Utils.parseSearchQuery()`, `Data.process()`, `UI.sortOptions` / `UI.screenSortOptions`, and dependent controls together.
6. **Exports:** If bundle contents or drawable naming change, keep `appfilter.xml`, `icontool_commands.txt`, `_icons/` filenames, and both ZIP flows synchronized (including multi-component `app.components` entries).
7. **Accessibility:** Give new interactive elements `tabindex`, `role`, menu/keyboard handling, and guarded tooltip/image fallbacks.

## 5. Coding Standards

Formatting:
- CSS uses M3-style tokens in `:root` (`--primary`, `--surface`, `--surface-container-*`, `--outline`, `--chart-*`); there is no `md-sys-` prefix.
- Typography uses `rem` units for accessibility.
- `deno.json` configures `src/` formatting: 2 spaces, single quotes, 80-column width.

Naming Conventions:
- **Namespaces:** PascalCase top-level objects (`App`, `Utils`, `Templates`, `Components`, `Actions`, `Data`, `UI`).
- **Functions:** camelCase (e.g. `createListRow`, `loadGraphData`).
- **Templates:** camelCase (e.g. `Templates.gridCard`).
- **CSS Classes:** kebab-case (e.g. `list-row`, `status-wip`).

Error Handling:
- Use `Components.Toast.show(message, 'error')` for user-facing issues.
- Use `Data.fetchJson(url, fallback)` for non-critical JSON; route image failures through `Utils.handleImageError()` or guarded fallbacks.
- Keep `Data.fetchJson()` and optional-load `catch` blocks from surfacing fatal errors to users.

## 6. Testing & Validation

- **Type checks:** `// @ts-check` + JSDoc; validate with `deno check src/script.js` (or VS Code's JS type checker) when Deno is available.
- **Local runtime:** serve `src/` over HTTP; opening `index.html` as `file://` will break `fetch()`.
- **Manual Validation:**
  - Confirm first rows appear before graph/XML and later `links_2+` requests; confirm deep links that need graphs still wait for them.
  - Verify shift-click range selection and keyboard selection in list and grid views.
  - Verify URL restore for `q`, `view`, `sort`, `regex`, `filters`, `page`, and `tab`.
  - Verify plain search, invalid regex, `scr-N`, `#N`, and graph-backed domain regex queries.
  - Verify deferred data refresh preserves selection, already-rendered rows, and scroll position.
  - Verify `in_lawnicons` and `links` filters: multi-component AppFilter copying across `appfilter.xml` and `lawnicons_appfilter.xml`, linked-component count in Requests column, staggered `links_2+` batch loading on scroll without duplicate rows, and Play Store `installs` display.
  - Verify priority chart rendering and `roi-desc` / `roi-asc` impact sorting.
  - Verify screens view sorting, home-screen cards/images, and tab switching.
  - Verify low-quality badge, contribution plan persistence/import, and icon-review linting.
  - Verify ZIP contents for both flows (`new` and `link` in the selection flow) and matching filenames in `_icons/`, `appfilter.xml`, and `icontool_commands.txt`.
  - Verify popovers, horizontal scroll, and touch targets below 640px.

## 7. Configuration & Environment

- **Primary data:** `requests.json`.
- **Filters:** `CONFIG.data.filters` defines load and display order (`plan`, `supported`, `redesign`, `easy`, `foss`, `nameinuse`, `match`, `stale`, `in_lawnicons`, `links`, `unlabeled`); each filter uses `assets/filters/<id>.json` except synthesized `plan`, computed `unlabeled`, and staggered `links` (`links_requested.json` + `links_<n>.json`).
- **Analytics:** `sets_stats.json` (popularity), `domain_stats.json` (domain card/tooltips), `activity_stats.json` (activity card), `fulfillment_history.json` (icons/day, supported/day), `trending_baseline.json` (trending sort), `review_issues.json` (QA badge/page), plus `roi_score` and `priority` on `requests.json` entries (priority chart / impact sort).
- **Graphs & AppFilters:** `requests_graph.json` and `screens_graph.json` power geo prefixes, screen searches, and regex domain matching; `appfilter.xml` and `lawnicons_appfilter.xml` power existing-icon checks and multi-component linking.
- **Automation & Enrichment:** `.github/workflows/prune_requests.yml` orchestrates `fetch_emails.py`, `email_parser.py`, `save_trending_baseline.py`, `prune_requests.py`, `generate_auto_tags.py`, `update_foss_tags.py`, `generate_lawnicons_tags.py`, `dump_play_info_links.py`, and `incremental_review.py` alongside `monocons-android` SVGs.
- **Local UI persistence:** `localStorage` keys `monocons_contribution*`; selected rows are runtime-only.
- **URL:** query parameters listed in section 2 act as environment state.
- **Static hosting:** Vercel; `public/` contains `robots.txt` and `sitemap.xml`; cache headers live in `src/vercel.json`.

## 8. Decision Priorities

1. **Simplicity:** Prefer readable vanilla JS over clever abstractions.
2. **Performance:** Keep the common first paint independent of heavy datasets (graphs, XML, and later `links_2+` batches); maintain smooth 60fps scrolling.
3. **Determinism:** The same URL (plus `localStorage` contribution state) must yield the same UI state.
4. **Developer Experience:** Keep JSDoc/types accurate so contributors can work without a framework.

## 9. Known Pitfalls

- **DOM collisions:** Full `innerHTML` reset is acceptable at the start of `UI.render()`, but incremental growth must go through `loadMore()` and a `DocumentFragment`.
- **Event delegation:** Use `e.target.closest()` carefully across SVG/icon children, popover items, and dynamically inserted tool pages.
- **Mode coupling:** Regex/special queries and screens/home-screen views share the same render path; keep control visibility, `App.state`, URL state, and `needsGraphData` in sync.
- **Filter data shape:** Filter entries may be strings or objects (`id`, `existing_drawable`, `lawnicons_drawable`, `name`, `drawable`, `installs`, `components`); assuming one shape silently drops metadata or linked components.
- **Third-party drawables (`in_lawnicons`):** If a third-party filter includes metadata for an upstream SVG, use a distinct key (e.g., `lawnicons_drawable`) rather than `existing_drawable`. The dashboard loads `existing_drawable` as a local Monocons SVG, resulting in 404s if the file is absent from `assets/qa_issues/svgs/`.
- **Staggered `links` & deduplication:** Remaining `links_2.json+` batches append dynamically on scroll; keep deduplication intact across `idMap`, `Data.process()`, `UI.handleLinksScrollLoad()`, and `App.state.renderedIds` so items present in both `requests.json` and `links_*.json` do not duplicate.
- **Regex:** Wrap `new RegExp(...)` in `try/catch`; invalid input must not crash `Data.process()`.
- **Deferred refresh:** Re-rendering after background loads must restore `renderedCount` and scroll; avoid per-dataset renders.
- **Missing or unused files are intentional:** `plan.json` does not exist (`plan` is synthesized), `unlabeled` is computed, `creation_odds.json` is unused at runtime, and `links` uses split `links_requested.json` + `links_<n>.json` files rather than `links.json`.
- **ZIP dependency:** `fflate` is loaded by a script tag on first export; always `await loadFflate()` before using it.
- **Persistence:** Contribution plan comes from `localStorage` (`monocons_contribution*`); clearing it changes the `plan` tag and badges even if the URL is unchanged.

## 10. Contribution Boundaries

Allowed:
- UI polish and M3 alignment.
- New local-only Python scripts for data cleaning, Play Store enrichment, and QA.
- New filter definitions: add the ID to `CONFIG.data.filters`, provide `assets/filters/<id>.json`, and update metadata/UI labels.

Requires explicit approval:
- Adding new heavy JS dependencies or reintroducing CDN-blocking startup scripts.
- Adding nested data structures to `requests.json`.
- Changing the core `Data.process()` loop, loading phases / staggered `links` batch contract, or the ZIP file contract.
