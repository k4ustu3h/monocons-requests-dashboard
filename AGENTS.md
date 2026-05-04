## 1. Purpose

### Project Summary
A high-performance, vanilla-web dashboard for managing community icon requests for Lawnicons. It transforms static JSON datasets into an interactive triage tool for contributors to visualize, filter, and bulk-export assets and metadata.

### Scope
Included:
- Infinite scrolling/Lazy loading for datasets exceeding 10k items.
- Deep-linking via URL parameters for shared filter states.
- Client-side bulk zipping and metadata generation (AppFilter, PR templates).
- Material Design 3 (M3) compliant UI with full keyboard accessibility.
- Local Python scripts for data enrichment and build-time tag generation.

Excluded (non-goals):
- Server-side state or user databases (remain strictly static).
- Framework-specific implementations (React, Vue, etc.).
- Direct file system writes from the browser.

## 2. System Architecture

### Tech Stack
- **Languages:** JavaScript (ESNext), CSS3 (Modern), HTML5, Python 3.10+ (scripts).
- **Frameworks:** None (Vanilla).
- **Runtime:** Browser-based.
- **Build system:** Static Deployment (Vercel).

### High-Level Structure
- **Data Layer:** `requests.json` plus auxiliary analytics/filter datasets (`sets_stats.json`, `creation_odds.json`, `domain_stats.json`, `activity_stats.json`, and `assets/filters/*.json`).
- **State Layer:** Runtime state is centralized in `App.state` with lookup maps for IDs, tags, filter metadata, existing SVG links, analytics tables, and URL-backed UI mode.
- **Namespace Layer:** Logic is encapsulated in `App`, `Data`, `UI`, `Actions`, `Utils`, and `Templates` objects.
- **Event Layer:** Input handling is split between document-level delegation, targeted control listeners, popover menus, and keyboard navigation handlers.
- **Data flow:** Static JSON → `Promise.all` fetch/init → `App.state` maps/analytics → `Data.process()` → `UI.render()` / `UI.loadMore()` → `Templates` / DOM.

### Filter Dataset Shape
- Filter JSON files are keyed by filter ID.
- Entries may be simple component-name strings or objects with metadata such as `id` and `existing_drawable`.
- `unlabeled` is computed at runtime from requests that have no other tags.

### `requests.json` Structure
- `firstAppearance` and `lastRequested` are Unix timestamps (seconds since epoch).
- `installs` is a string with commas and a plus sign (e.g., "100,000,000+").

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
      "installs": "100,000,000+"
    },
    {
      "drawable": "subway_city",
      "requestCount": 50,
      "firstAppearance": 1767196800.0,
      "lastRequested": 1767196800.0,
      "label": "App Title",
      "componentName": "com.example.foo/com.example.foo.MainActivity",
      "installs": "500,000+"
    }
  ]
}
```

### `appfilter.xml` structure
```xml
<resources>
  <item component="ComponentInfo{COMPONENT_NAME}" drawable="ICON_NAME" name="APP_NAME" />
  <!-- Example -->
  <item component="ComponentInfo{app.lawnchair.lawnicons/app.lawnchair.lawnicons.MainActivity}" drawable="lawnicons" name="Lawnicons" />
</resources>
```

### Dependency Rules
Allowed:
- Small, single-purpose utility libraries (e.g., `fflate` for compression).
- CDNs for external libraries.

Forbidden:
- UI Frameworks (React/Vue/Angular).
- CSS-in-JS libraries.
- Node.js build-time requirements for the dashboard itself (must run via static server).

## 3. Invariants (Must Never Break)

Functional:
- URL parameters must be the source of truth for `q`, `view`, `sort`, `regex`, `filters`, and `geo` on page load.
- Selection state (`App.state.selected`) must persist through search, filter, sort, and view updates.
- Regex mode and geo-batch mode must remain mutually exclusive in UI state and control visibility.
- Exported filenames in ZIP must match the generated `drawable` values written to `appfilter.xml`, `icontool_commands.txt`, and PR/link metadata.
- Drawable collision handling must stay deterministic: the same label/package pair reuses one drawable, while conflicting names for different apps receive stable suffixes.

Architectural:
- String HTML fragments should reside in the `Templates` object; direct DOM creation is acceptable for small controls, observers, and focus/tooltip plumbing.
- DOM manipulation must be batch-processed using `DocumentFragment`.
- The `App.state.idMap` must maintain O(1) lookup for all loaded apps.
- `App.state.appTags`, `filterMetadata`, and analytics maps are the canonical lookup sources after initialization.

Performance:
- **Max startup time:** < 500ms to first meaningful paint.
- **Critical hot paths:** `Data.process` (filtering loop) and `UI.loadMore` (rendering batch).

## 4. Modification Protocol

1. **Identify:** Check whether the change is Build-time (Python/data generation) or Runtime (JS/UI/export) work.
2. **State:** Update `App.state` and related lookup initialization if the runtime data shape changes.
3. **JSDoc:** Update `@typedef` / `@type` annotations in `script.js` when adding state, filter metadata, or dataset fields.
4. **URL Sync:** If behavior is deep-linkable, update both `Data.loadUrlState()` and `Data.syncUrlState()`.
5. **Processing Path:** If search, tags, sort, or geo batching change, update `Utils.parseSearchQuery()`, `Data.process()`, and any dependent UI controls together.
6. **Exports:** If bundle contents or drawable naming change, keep `appfilter.xml`, `filter_config.json`, `icontool_commands.txt`, and PR output synchronized.
7. **Accessibility:** Ensure new interactive elements have `tabindex`, `role`, and keyboard listeners or menu navigation support.

## 5. Coding Standards

Formatting:
- CSS follows Material Design 3 naming conventions for tokens (Color, Shape, Elevation).
- Typography uses `rem` units for accessibility.

Naming Conventions:
- **Namespaces:** PascalCase (e.g., `App.UI`).
- **Functions:** camelCase (e.g., `createListRow`).
- **Templates:** camelCase (e.g., `Templates.gridCard`).
- **CSS Classes:** kebab-case (e.g., `list-row`, `status-wip`).

Error Handling:
- Use `Toast.show(message, "error")` for user-facing issues.
- Keep external asset failures non-fatal by routing image fallbacks through `Utils.handleImageError()` or equivalent guarded behavior.

## 6. Testing & Validation

- **Type checks:** Managed via `// @ts-check` and JSDoc in VS Code.
- **Manual Validation:**
  - Verify shift-click range selection and keyboard selection in both list and grid views.
  - Verify URL restore for `q`, `view`, `sort`, `regex`, `filters`, and `geo`.
  - Verify invalid regex input fails safely without crashing the app.
  - Verify geo-batch configuration toggles correctly and remains mutually exclusive with regex mode.
  - Verify ZIP contents for `appfilter.xml`, `filter_config.json`, `icontool_commands.txt`, and `pr_description.md` in both `new` and `link` flows.
  - Verify horizontal scroll and popover usability on mobile (< 640px).

## 7. Configuration & Environment

- **requests.json:** The primary database.
- **Filter JSONs:** Provide labels/descriptions and per-app tag membership, optionally with `existing_drawable` metadata.
- **Analytics JSONs:** `sets_stats.json`, `creation_odds.json`, `domain_stats.json`, and `activity_stats.json` enrich ranking and dashboard cards.
- **URL:** Query parameters (`q`, `view`, `sort`, `regex`, `filters`, `geo`) act as environment state.

## 8. Decision Priorities

1. **Simplicity:** Prefer readable vanilla JS over clever abstractions.
2. **Performance:** Prioritize smooth 60fps scrolling over complex animations.
3. **Determinism:** The same URL must always yield the same UI state.
4. **Developer Experience:** Use JSDoc to make the code accessible to junior contributors.

## 9. Known Pitfalls

- **DOM Collisions:** Wiping `innerHTML` is acceptable at the start of a full render, but incremental list growth must still happen through `loadMore()` appending to avoid jank.
- **Event Delegation:** Use `e.target.closest()` carefully across SVG/icon children and popover menu items; click handling is no longer limited to the root container.
- **Mode Coupling:** Regex mode and geo-batch mode share the same search affordance and can drift out of sync if visibility and state toggles are not updated together.
- **Filter Data Shape:** Filter files may contain strings or objects; code that assumes one shape will silently drop metadata like `existing_drawable`.
- **Regex:** Invalid regex input in search must be caught via `try/catch` to prevent app crash.

## 10. Contribution Boundaries

Allowed:
- UI polish and M3 alignment.
- New local-only Python scripts for data cleaning.
- New filter definitions in `CONFIG.data.filters`.

Requires explicit approval:
- Adding new heavy JS dependencies.
- Re-introducing nested data structures in `requests.json`.
- Modifying the core `Data.process()` loop or bulk export file contract.
