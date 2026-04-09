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
- **Data Layer:** `requests.json` (Flat structure) and associated filter JSONs.
- **Namespace Layer:** Logic encapsulated in `App`, `Data`, `UI`, `Actions`, `Utils`, and `Templates` objects.
- **Event Layer:** Single-source event delegation on the root container.
- **Data flow:** Static Data → Fetch → State Map → Logic Pipeline → DOM Templates.

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
- URL parameters must be the source of truth for view/sort/filter on page load.
- Selection state (`App.state.selected`) must persist through search and filter updates.
- Exported filenames in ZIP must strictly match `drawable` attributes in `!appfilter.xml`.

Architectural:
- All HTML generation must reside in the `Templates` object.
- DOM manipulation must be batch-processed using `DocumentFragment`.
- The `App.state.idMap` must maintain O(1) lookup for all loaded apps.

Performance:
- **Max startup time:** < 500ms to first meaningful paint.
- **Critical hot paths:** `Data.process` (filtering loop) and `UI.loadMore` (rendering batch).

## 4. Modification Protocol

1. **Identify:** Check if the change is a Build-time (Python) or Runtime (JS) concern.
2. **State:** Update `App.state` definition if data shape changes.
3. **JSDoc:** Update `@type` definitions in `script.js` to ensure IntelliSense accuracy.
4. **Accessibility:** Ensure new interactive elements have `tabindex`, `role`, and keyboard listeners.

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
- Use `onerror` fallbacks for all external assets (icons).

## 6. Testing & Validation

- **Type checks:** Managed via `// @ts-check` and JSDoc in VS Code.
- **Manual Validation:**
    - Verify shift-click selection ranges.
    - Verify ZIP contents for `!appfilter.xml` validity.
    - Verify horizontal scroll on mobile (< 640px).

## 7. Configuration & Environment

- **requests.json:** The primary database.
- **localStorage:** Used exclusively for `icontoolPath` persistence.
- **URL:** Query parameters (`q`, `view`, `sort`, `regex`, `filters`) act as environment state.

## 8. Decision Priorities

1. **Simplicity:** Prefer readable vanilla JS over clever abstractions.
2. **Performance:** Prioritize smooth 60fps scrolling over complex animations.
3. **Determinism:** The same URL must always yield the same UI state.
4. **Developer Experience:** Use JSDoc to make the code accessible to junior contributors.

## 9. Known Pitfalls

- **DOM Collisions:** Wiping `innerHTML` causes scroll jumping. Use `loadMore` appending instead.
- **Event Delegation:** Ensure `e.target.closest()` is used correctly to avoid missing clicks on SVG children.
- **Regex:** Invalid regex input in search must be caught via `try/catch` to prevent app crash.

## 10. Contribution Boundaries

Allowed:
- UI polish and M3 alignment.
- New local-only Python scripts for data cleaning.
- New filter definitions in `CONFIG.data.filters`.

Requires explicit approval:
- Adding new heavy JS dependencies.
- Re-introducing nested data structures in `requests.json`.
- Modifying the Core `processData` loop.
