/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS with JSDoc
 */

// ==========================================
// 0. TYPES & INTERFACES
// ==========================================

/// <reference types="https://cdn.skypack.dev/fflate@0.8.2/lib/index.d.ts" />

/**
 * @typedef {Object} AppEntry
 * @property {string} drawable
 * @property {string} label
 * @property {string} componentName
 * @property {number} requestCount
 * @property {number} firstAppearance
 * @property {number} lastRequested
 * @property {string} [installs]
 */

/**
 * @typedef {Object} FilterMetadata
 * @property {string} label
 * @property {string} [description]
 */

/**
 * @typedef {Object} AppState
 * @property {"list" | "grid"} view
 * @property {string} sort
 * @property {string} search
 * @property {boolean} regexMode
 * @property {Set<string>} selected
 * @property {Map<string, Set<string>>} appTags
 * @property {Map<string, FilterMetadata>} filterMetadata
 * @property {Set<string>} activeFilters
 * @property {string | null} lastSelectedId
 * @property {Map<string, AppEntry>} idMap
 * @property {number} renderedCount
 * @property {AppEntry[]} currentData
 * @property {string} actionMode
 * @property {string} icontoolPath
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = {
  data: {
    endpoint: "assets/requests.json",
    assetsPath: "extracted_png/",
    iconExtension: ".png",
    filterPath: "assets/filters/",
    // Order matters for UI
    filters: ["wip", "support", "easy", "conflict", "link", "stale", "unlabeled"]
  },
  urls: {
    playStore: "https://play.google.com/store/apps/details?id=",
    fDroid: "https://f-droid.org/en/packages/",
    izzy: "https://www.izzysoft.de/applists/category/named/",
    galaxyStore: "https://galaxystore.samsung.com/detail/"
  },
  ui: {
    batchSize: 500,
  }
};

const ICONS = {
  check: `<svg><use href="#ic-check"/></svg>`,
  download: `<svg><use href="#ic-download"/></svg>`,
  play: `<svg><use href="#ic-play"/></svg>`,
  dots: `<svg><use href="#ic-dots"/></svg>`,
  copy: `<svg><use href="#ic-copy"/></svg>`,
  fDroid: `<svg><use href="#ic-fdroid"/></svg>`,
  izzyOnDroid: `<svg><use href="#ic-izzyondroid"/></svg>`,
  galaxyStore: `<svg><use href="#ic-galaxystore"/></svg>`,
  terminal: `<svg><use href="#ic-terminal"/></svg>`,
  regex: `<svg><use href="#ic-regex"/></svg>`
};

const DEFAULTS = {
  view: "list",
  sort: "req-desc",
  search: "",
  regex: false
};

// ==========================================
// 2. STATE & DOM
// ==========================================

const App = {
  /** @type {AppEntry[]} */
  data: [],

  /** @type {AppState} */
  state: {
    view: "list",
    sort: "req-desc",
    search: "",
    regexMode: false,
    selected: new Set(),
    appTags: new Map(),
    filterMetadata: new Map(),
    activeFilters: new Set(),
    lastSelectedId: null,

    // Runtime
    idMap: new Map(),
    renderedCount: 0,
    currentData: [],

    actionMode: "new",
    icontoolPath: localStorage.getItem("icontoolPath") || ""
  },

  dom: {
    /** @type {HTMLDivElement} */
    container: /** @type {any} */ (document.getElementById("appContainer")),
    /** @type {HTMLDivElement} */
    listHeader: /** @type {any} */ (document.getElementById("listHeader")),
    /** @type {HTMLInputElement} */
    headerCheck: /** @type {any} */ (document.getElementById("headerCheck")),
    /** @type {HTMLDivElement} */
    headerCount: /** @type {any} */ (document.getElementById("headerCount")),
    /** @type {HTMLDivElement} */
    sentinel: /** @type {any} */ (document.getElementById("scrollSentinel")),

    /** @type {HTMLInputElement} */
    inputSearch: /** @type {any} */ (document.getElementById("searchInput")),
    /** @type {HTMLButtonElement} */
    clearBtn: /** @type {any} */ (document.getElementById("clearSearchBtn")),
    /** @type {HTMLButtonElement} */
    regexBtn: /** @type {any} */ (document.getElementById("regexBtn")),

    /** @type {HTMLSelectElement} */
    selectSort: /** @type {any} */ (document.getElementById("sortSelect")),
    /** @type {HTMLSelectElement} */
    selectView: /** @type {any} */ (document.getElementById("viewSelect")),
    /** @type {HTMLDivElement} */
    filterBox: /** @type {any} */ (document.getElementById("filterContainer")),

    /** @type {HTMLButtonElement} */
    mobileFilterBtn: /** @type {any} */ (document.getElementById("mobileFilterBtn")),
    /** @type {HTMLSpanElement} */
    mobileFilterCount: /** @type {any} */ (document.getElementById("mobileFilterCount")),
    /** @type {HTMLElement} */
    mobileFilterMenu: /** @type {any} */ (document.getElementById("mobileFilterMenu")),

    /** @type {HTMLDivElement} */
    sbBar: /** @type {any} */ (document.getElementById("selectionBar")),
    /** @type {HTMLDivElement} */
    sbCount: /** @type {any} */ (document.getElementById("sbCount")),
    /** @type {NodeListOf<HTMLButtonElement>} */
    sbChips: document.querySelectorAll(".sb-chip"),
    /** @type {HTMLButtonElement} */
    sbClearBtn: /** @type {any} */ (document.getElementById("sbClearBtn")),
    /** @type {HTMLInputElement} */
    sbPathInput: /** @type {any} */ (document.getElementById("sbPathInput")),
    /** @type {HTMLButtonElement} */
    sbDownloadBtn: /** @type {any} */ (document.getElementById("sbDownloadBtn")),

    /** @type {HTMLElement} */
    rowMenu: /** @type {any} */ (document.getElementById("rowMenu")),
    /** @type {HTMLDivElement} */
    toastBox: /** @type {any} */ (document.getElementById("toastContainer"))
  }
};

// ==========================================
// 3. UTILITIES
// ==========================================
const Utils = {
  /**
   * @param {number} unix
   * @returns {string}
   */
  formatDate(unix) {
    if (!unix) return "—";
    return new Date(unix * 1000).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  },

  /**
   * @param {string} [str]
   * @returns {number}
   */
  parseInstalls(str) {
    if (!str) return -1;
    const clean = str.toString().replace(/[,+]/g, '');
    return parseInt(clean, 10) || 0;
  },

  /**
   * @param {string} label
   * @returns {string}
   */
  sanitizeDrawableName(label) {
    if (!label) return "unknown";
    let name = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    name = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    name = name.replace(/^_+|_+$/g, "");
    if (/^[0-9]/.test(name)) name = "_" + name;
    return name || "icon";
  },

  /**
   * @param {string} rawQuery
   * @returns {{ text: string; tags: Set<string> }}
   */
  parseSearchQuery(rawQuery) {
    const result = {text: "", tags: new Set()};
    const tokenRegex = /\b(?:is|tag|in):([a-z0-9-_]+)\b/gi;

    const cleanQuery = rawQuery.replace(tokenRegex, (_, tag) => {
      const lowerTag = tag.toLowerCase();
      // Check if tag exists in config
      if (CONFIG.data.filters.includes(lowerTag)) {
        result.tags.add(lowerTag);
      }
      return "";
    });

    result.text = cleanQuery.trim();
    return result;
  },

  /**
   * @param {AppEntry} app
   * @returns {string}
   */
  generateXml(app) {
    const cmp = app.componentName;
    const name = app.label.replace(/"/g, '&quot;'); // Escape for XML
    const draw = Utils.sanitizeDrawableName(app.label);
    return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
  },

  /**
   * @param {string} id
   * @returns {string[]}
   */
  getTagsForApp(id) {
    const tags = [];
    const appTags = App.state.appTags.get(id);
    if (appTags) {
      CONFIG.data.filters.forEach(fid => {
        if (appTags.has(fid)) tags.push(fid);
      });
    }
    return tags;
  },

  /**
   * @param {string} id
   * @param {Set<string>} s
   */
  mutualExclusiveTags(id, s) {
    if (id === "unlabeled") {
      if (s.has("unlabeled")) {
        s.delete("unlabeled"); // Toggle Off
      } else {
        s.clear();             // Clear others
        s.add("unlabeled");    // Toggle On
      }
    } else {
      // Clicking a normal filter
      if (s.has("unlabeled")) {
        s.delete("unlabeled"); // Clear unlabeled if active
      }

      // Standard Toggle
      if (s.has(id)) s.delete(id);
      else s.add(id);
    }
  },
};

// ==========================================
// 4. TEMPLATES
// ==========================================
const Templates = {
  /**
   * @param {AppEntry} app
   * @param {boolean} isSelected
   * @param {string[]} tags
   * @param {string} iconUrl
   * @param {string} firstStr
   * @param {string} lastStr
   * @returns {string}
   */
  listRow(app, isSelected, tags, iconUrl, firstStr, lastStr) {
    const id = app.componentName;
    const name = app.label;
    const pkg = id.split('/')[0];
    const isUnknown = app.drawable === "unknown" || name === "(Unknown App)";

    const tagHtml = tags.map(tagId => {
      const meta = App.state.filterMetadata.get(tagId);
      const label = meta ? meta.label : tagId;
      const desc = meta ? meta.description : "";
      return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
    }).join("");

    const iconHtml = isUnknown
        ? `<div class="fallback-icon-row">No Icon</div>`
        : `<img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
         <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    const installsRaw = app.installs ? app.installs.replace(/[,+]/g, '') : null;
    const displayInstalls = installsRaw ? new Intl.NumberFormat('en', {notation: "compact"}).format(parseInt(installsRaw)) + "+" : "—";

    return `
      <div class="list-row ${isSelected ? 'selected' : ''}"
        data-id="${id}"
        tabindex="0" 
        role="row" 
        aria-selected="${isSelected}">
        <div class="check-col">
          <input type="checkbox" ${isSelected ? "checked" : ""} class="row-checkbox" tabindex="-1" />
        </div>
        <div class="icon">${iconHtml}</div>
        <div class="name-col">
          <div class="name-row">
            ${tagHtml}
            <span class="app-name" style="${isUnknown ? "display: none" : ""}">${name}</span>
          </div>
          <span class="pkg-name">${id}</span>
        </div>
        <div class="col req">${app.requestCount}</div>
        <div class="col install" title="${app.installs || '0'} installs in Play Store">${displayInstalls}</div>
        <div class="col first" style="line-height:1.4">
          <div>${firstStr}</div>
          <div>Last: ${lastStr}</div>
        </div>
        <div class="actions-col">
          <a class="action-btn" href="${iconUrl}" download title="Download icon"
            tabindex="0" role="button" aria-label="Download" >${ICONS.download}</a>
          <a class="action-btn" href="${CONFIG.urls.playStore}${pkg}" target="_blank" title="Play Store"
            tabindex="0" role="button" aria-label="Play Store" >${ICONS.play}</a>
          <div class="action-btn ctx-trigger" title="More actions"
            tabindex="0" 
            role="button" 
            aria-label="More actions" 
            aria-haspopup="true">${ICONS.dots}</div>
        </div>
      </div>
    `;
  },

  /**
   * @param {AppEntry} app
   * @param {string[]} tags
   * @param {boolean} isSelected
   * @param {string} iconUrl
   * @returns {string}
   */
  gridCard(app, tags, isSelected, iconUrl) {
    const id = app.componentName;
    const isUnknown = app.drawable === "unknown";

    let contentHtml = "";
    const label = app.label === "(Unknown App)" ? id.split('/')[0] : app.label;

    if (isUnknown) {
      contentHtml = `
        <div class="fallback-icon-grid">
          <div style="font-weight:700; margin-bottom:4px;">No Icon</div>
          <div style="word-break:break-word;">${label}</div>
        </div>
      `;
    } else {
      contentHtml = `<img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${label}" />
      <div class="fallback-icon-grid" style="display:none">No Icon</div>`;
    }

    // Only show WIP tags on grid to avoid clutter
    const tagHtml = tags
        .filter(tagId => tagId === "wip")
        .map(tagId => {
          const meta = App.state.filterMetadata.get(tagId);
          const label = meta ? meta.label : tagId;
          const desc = meta ? meta.description : `Tagged with "${tagId}"`
          return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
        })
        .join("");

    return `
      <div class="grid-card ${isSelected ? 'selected' : ''}" data-id="${id}" title="${label}"
        tabindex="0" role="checkbox" aria-checked="${isSelected}">
        ${contentHtml}
        <div class="grid-overlay-tags">${tagHtml}</div>
        <div class="grid-overlay-check">
          <input type="checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none;" tabindex="-1">
        </div>
      </div>
    `;
  },

  /**
   * @returns {string}
   */
  emptyState() {
    return `
      <div class="empty-state">
        <svg><use href="#ic-search"/></svg>
        <h3>No requests found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
  },

  /**
   * @param {AppEntry} app
   * @returns {string}
   */
  rowMenu(app) {
    const id = app.componentName;
    const pkg = id.split('/')[0];
    const name = app.label;
    // escape single quotes for the inline onclick handler
    const safeName = name.replace(/'/g, "\\'");

    return `
      <div class="ctx-item" tabindex="0" role="menuitem" onclick="window.open('${CONFIG.urls.fDroid}${pkg}')">
        ${ICONS.fDroid} <span>F-Droid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" onclick="window.open('${CONFIG.urls.izzy}${pkg}')">
        ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" onclick="window.open('${CONFIG.urls.galaxyStore}${pkg}')">
        ${ICONS.galaxyStore} <span>Galaxy Store</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" tabindex="0" role="menuitem" onclick="Actions.copyToClipboard('${safeName}\\n${id}')">
        ${ICONS.copy} <span>Copy Name & ID</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" onclick="Actions.copyAppFilterEntry('${id}')">
        ${ICONS.copy} <span>Copy Appfilter</span>
      </div>
    `;
  },

  /**
   * @param {string} text
   * @param {string} icon
   * @returns {string}
   */
  toast(text, icon) {
    return `
      <div class="toast-icon">${icon}</div>
      <div class="toast-text">${text}</div>
    `;
  }
};

// ==========================================
// 5. TOAST SYSTEM
// ==========================================
const Toast = {
  /** @type {Set<string>} */
  activeToasts: new Set(),

  /**
   * @param {string} text
   * @param {"info" | "success" | "error"} [type]
   */
  show(text, type = "info") {
    const key = `${text}-${type}`;
    if (this.activeToasts.has(key)) return;

    if (App.dom.toastBox.children.length >= 3) {
      const first = App.dom.toastBox.firstElementChild;
      if (first) this.remove(/** @type {HTMLElement} */ (first));
    }

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.dataset.key = key;
    this.activeToasts.add(key);

    let iconSvg = ICONS.copy;
    if (type === "error") iconSvg = `<svg><use href="#ic-search"/></svg>`; // Using search as alert icon placeholder
    if (type === "success") iconSvg = `<svg><use href="#ic-download"/></svg>`;

    el.innerHTML = Templates.toast(text, iconSvg);
    App.dom.toastBox.appendChild(el);

    setTimeout(() => this.remove(el), 2500);
  },

  /**
   * @param {HTMLElement} el
   */
  remove(el) {
    if (el.classList.contains("hiding")) return;
    if (el.dataset.key) this.activeToasts.delete(el.dataset.key);
    el.classList.add("hiding");
    el.addEventListener("animationend", () => el.remove());
  }
};

// ==========================================
// 6. ACTIONS
// ==========================================
const Actions = {
  /**
   * @param {string} id
   * @param {MouseEvent | KeyboardEvent | null} [event]
   */
  toggleSelection(id, event = null) {
    const s = App.state.selected;
    const currentIdx = App.state.currentData.findIndex(a => a.componentName === id);

    // Handle Shift Click
    if (event && /** @type {MouseEvent} */ (event).shiftKey && App.state.lastSelectedId) {
      const lastIdx = App.state.currentData.findIndex(a => a.componentName === App.state.lastSelectedId);

      window.getSelection()?.removeAllRanges();

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const range = App.state.currentData.slice(start, end + 1);

        range.forEach(app => {
          s.add(app.componentName);
          UI.updateItemVisuals(app.componentName);
        });

        UI.updateHeader();
        return;
      }
    }

    if (s.has(id)) s.delete(id);
    else s.add(id);

    App.state.lastSelectedId = id;

    UI.updateItemVisuals(id);
    UI.updateHeader();
    UI.updateSelectionBar();
  },

  /**
   * @param {boolean} isChecked
   */
  toggleSelectAll(isChecked) {
    if (isChecked) {
      App.state.currentData.forEach(app => App.state.selected.add(app.componentName));
    } else {
      App.state.currentData.forEach(app => App.state.selected.delete(app.componentName));
    }

    const scrollY = window.scrollY;
    UI.render();
    window.scrollTo(0, scrollY);
  },

  /**
   * @param {string} key
   */
  toggleSortHeader(key) {
    const current = App.state.sort;
    const [currKey, currDir] = current.split('-');

    /** @type {Record<string, string>} */
    const defaults = {
      name: 'asc',
      req: 'desc',
      install: 'desc',
      time: 'desc'
    };

    let nextSort = "";
    if (currKey === key) {
      nextSort = `${key}-${currDir === 'asc' ? 'desc' : 'asc'}`;
    } else {
      nextSort = `${key}-${defaults[key]}`;
    }

    App.state.sort = nextSort;
    App.dom.selectSort.value = nextSort;
    UI.render();
  },

  /**
   * @param {string} text
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(_ => {
      Toast.show("Copied!");
      UI.closeContextMenu();
    });
  },

  /**
   * @param {string} id
   */
  copyAppFilterEntry(id) {
    const app = App.state.idMap.get(id);
    if (app) Actions.copyToClipboard(Utils.generateXml(app));
  },

  async downloadBundle() {
    if (typeof fflate === 'undefined') {
      Toast.show("fflate library missing", "error");
      return;
    }

    const selectedApps = App.data.filter(a => App.state.selected.has(a.componentName));
    if (selectedApps.length === 0) return;

    selectedApps.sort((a, b) => a.label.localeCompare(b.label));

    // UI Feedback
    const originalText = App.dom.sbDownloadBtn.innerHTML;
    App.dom.sbDownloadBtn.innerHTML = "Processing...";
    document.body.style.cursor = "wait";

    try {
      const mode = App.state.actionMode; // "new" | "link"
      const path = App.state.icontoolPath.trim().replace(/\/+$/, "") + "/";

       // fflate uses a simple object mapping paths to Uint8Arrays/Strings
       /** @type {Object.<string, Uint8Array | string | Object>} */
       const zipData = {};

       // Only include icons folder in "new" mode
       if (mode === "new") {
         zipData["icons"] = {};
       }

      let xmlAppFilter = "<resources>\n";
      let txtCommands = "";

      const prLines = new Set();
      const processedPackages = new Set();

      /**
       * Tracks drawable names globally to prevent file overwrites (e.g. app.svg, app_2.svg)
       * @type {Set<string>}
       */
      const usedDrawables = new Set();

      /**
       * Maps a specific App Identity (Label + Package) to a Drawable.
       *
       * This ensures if we have "App (com.a/Act1)" and "App (com.a/Act2)", they both get "app.svg"
       * @type {Map<string, string>}
       */
      const assignedDrawables = new Map();
      const fetchPromises = [];

      // --- LOOP ---
      selectedApps.forEach(app => {
        const cmp = app.componentName;
        const pkg = cmp.split('/')[0];
        const label = app.label.replace(/"/g, '&quot;');
        const cmdLabel = app.label.replace(/"/g, '\\"');

        // Resolve Drawable Name
        const appIdentity = `${app.label}|${pkg}`;
        let drawable = "";

        if (assignedDrawables.has(appIdentity)) {
          drawable = assignedDrawables.get(appIdentity);
        } else {
          drawable = Utils.sanitizeDrawableName(app.label);

          // Handle collision with DIFFERENT apps
          if (usedDrawables.has(drawable)) {
            let c = 2;
            while (usedDrawables.has(`${drawable}_${c}`)) c++;
            drawable = `${drawable}_${c}`;
          }

          usedDrawables.add(drawable);
          assignedDrawables.set(appIdentity, drawable);
        }

        // Appfilter entry
        xmlAppFilter += `    <item component="ComponentInfo{${cmp}}" drawable="${drawable}" name="${label}" />\n`;

        // Commands
        if (App.state.icontoolPath) {
          const cmdType = mode === "new" ? "add" : "link";
          const svgPath = mode === "new" ? `"${path}${drawable}.svg"` : `"${drawable}"`;
          txtCommands += `python3 ./icontool.py ${cmdType} ${svgPath} ${cmp} "${cmdLabel}"\n`;
        }

        // PR Description
        if (!processedPackages.has(pkg)) {
          processedPackages.add(pkg);
          
          if (mode === "new") {
            prLines.add(`${app.label} (\`${pkg}\`)`);
          } else {
            prLines.add(`${app.label} (\`${pkg}\` → \`${drawable}.svg\`)`);
          }
        }

       // Queue Icon Fetch (only in "new" mode)
         if (mode === "new" && !zipData.icons[`${drawable}.png`]) {
           const url = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
           const p = fetch(url)
               .then(r => r.ok ? r.arrayBuffer() : null)
               .then(buf => {
                 if (buf) zipData.icons[`${drawable}.png`] = new Uint8Array(buf);
               })
               .catch(() => {});
           fetchPromises.push(p);
         }
      });

      // --- FINALIZE OUTPUTS ---
      App.dom.sbDownloadBtn.innerHTML = "Fetching...";
      await Promise.all(fetchPromises);

      // 1. XML
      xmlAppFilter += "</resources>";
      zipData["!appfilter.xml"] = fflate.strToU8(xmlAppFilter);

      // 2. Config
      const filterConfig = {
        "label": "Selection",
        "description": "Sample description",
        "selection": selectedApps.map(a => a.componentName)
      };
      zipData["!filter_config.json"] = fflate.strToU8(JSON.stringify(filterConfig, null, 2));

      // 3. Commands
      if (txtCommands) zipData["!icontool_commands.txt"] = fflate.strToU8(txtCommands);

      let mdPR = `## Icons \n<!-- Generated via Dashboard -->\n\n`;
      mdPR += (mode === "new" ? "### Added\n" : "### Linked\n");
      mdPR += Array.from(prLines).join("\n") + "\n";
      zipData["!pr_description.md"] = fflate.strToU8(mdPR);

      // 6. Zip & Download
      App.dom.sbDownloadBtn.innerHTML = "Zipping...";
      const content = fflate.zipSync(zipData, { level: 6 });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([content], { type: 'application/zip' }));
      link.download = `lawnicons-${mode}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      Toast.show(`Downloaded bundle (${mode})`, "success");

    } catch (e) {
      console.error(e);
      Toast.show("Failed to generate zip", "error");
    } finally {
      document.body.style.cursor = "default";
      App.dom.sbDownloadBtn.innerHTML = originalText;
    }
  }
};

// ==========================================
// 7. DATA PROCESSING
// ==========================================
const Data = {
  init() {
    Promise.all([
      fetch(CONFIG.data.endpoint).then(r => r.json()),
      ...CONFIG.data.filters.map(id => this.fetchFilterData(id))
    ])
        .then(([json, ...filterObjects]) => {
          App.data = json.apps;

          // Build ID Map
          App.state.idMap = new Map();
          App.data.forEach(app => App.state.idMap.set(app.componentName, app));

          // Init Tags
          App.state.appTags = new Map();
          App.state.filterMetadata = new Map();

          // Process Filters
          filterObjects.forEach((obj, index) => {
            if (!obj) return;
            const id = CONFIG.data.filters[index];

            App.state.filterMetadata.set(id, {
              label: obj.label,
              description: obj.description
            });

            if (id === "unlabeled") {
              this.computeUnlabeled(id);
            } else if (obj[id] && Array.isArray(obj[id])) {
              obj[id].forEach((/** @type {string} */ appId) => this.addTag(appId, id));
            }
          });

          this.loadUrlState();
          UI.init();
        })
        .catch(e => {
          console.error(e);
          Toast.show("Failed to load data", "error");
        });
  },

  /**
   * @param {string} id
   * @returns {Promise<any>}
   */
  async fetchFilterData(id) {
    if (id === "unlabeled") {
      return {
        label: "Unlabeled",
        description: "Requests with medium to high complexity and the lowest completion odds.",
        unlabeled: []
      };
    }
    try {
      const res = await fetch(`${CONFIG.data.filterPath}${id}.json`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * @param {string} tagId
   */
  computeUnlabeled(tagId) {
    App.data.forEach(app => {
      const id = app.componentName;
      const existingTags = App.state.appTags.get(id);
      if (!existingTags || existingTags.size === 0) {
        this.addTag(id, tagId);
      }
    });
  },

  /**
   * @param {string} id
   * @param {string} tag
   */
  addTag(id, tag) {
    if (!App.state.appTags.has(id)) App.state.appTags.set(id, new Set());
    App.state.appTags.get(id).add(tag);
  },

  process() {
    let data = App.data;
    const s = App.state;

    // Search
    const query = Utils.parseSearchQuery(s.search);
    const activeFilters = new Set([...s.activeFilters, ...query.tags]);

    // Filter
    if (activeFilters.size > 0) {
      data = data.filter(app => {
        const id = app.componentName;
        const tags = s.appTags.get(id);
        if (!tags) return false;
        return Array.from(activeFilters).every(fid => tags.has(fid));
      });
    }

    // Text Search
    if (query.text) {
      if (s.regexMode) {
        try {
          const regex = new RegExp(query.text, 'i');
          data = data.filter(a => regex.test(a.label) || regex.test(a.componentName));
        } catch {
          data = [];
        }
      } else {
        const term = query.text.toLowerCase();
        data = data.filter(a =>
            a.label.toLowerCase().includes(term) || a.componentName.toLowerCase().includes(term)
        );
      }
    }

    // Sort
    data = [...data];
    if (s.sort === "rand") {
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
    } else {
      /** @type {Record<string, (a: AppEntry, b: AppEntry) => number>} */
      const sorters = {
        "req-desc": (a, b) => b.requestCount - a.requestCount,
        "req-asc": (a, b) => a.requestCount - b.requestCount,
        "install-desc": (a, b) => Utils.parseInstalls(b.installs) - Utils.parseInstalls(a.installs),
        "install-asc": (a, b) => Utils.parseInstalls(a.installs) - Utils.parseInstalls(b.installs),
        "name-asc": (a, b) => a.label.localeCompare(b.label),
        "name-desc": (a, b) => b.label.localeCompare(a.label),
        "time-desc": (a, b) => b.firstAppearance - a.firstAppearance,
        "time-asc": (a, b) => a.firstAppearance - b.firstAppearance
      };
      if (sorters[s.sort]) data.sort(sorters[s.sort]);
    }

    App.state.currentData = data;
  },

  loadUrlState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) {
      App.state.search = params.get("q") || "";
      App.dom.inputSearch.value = App.state.search;
      if (App.state.search) App.dom.clearBtn.style.display = "flex";
    }
    if (params.has("view")) {
      const v = params.get("view");
      if (v === "list" || v === "grid") App.state.view = /** @type {"list"|"grid"} */ (v);
      App.dom.selectView.value = App.state.view;
    }
    if (params.has("sort")) {
      App.state.sort = params.get("sort") || DEFAULTS.sort;
      App.dom.selectSort.value = App.state.sort;
    }
    if (params.has("regex")) {
      App.state.regexMode = true;
      App.dom.regexBtn.classList.add("active");
    }
    if (params.has("filters")) {
      params.get("filters")?.split(",").forEach(t => {
        if (CONFIG.data.filters.includes(t)) App.state.activeFilters.add(t);
      });
    }
  },

  syncUrlState() {
    const s = App.state;
    const params = new URLSearchParams(window.location.search);

    if (s.search) params.set("q", s.search); else params.delete("q");
    if (s.view !== DEFAULTS.view) params.set("view", s.view); else params.delete("view");
    if (s.sort !== DEFAULTS.sort) params.set("sort", s.sort); else params.delete("sort");
    if (s.regexMode) params.set("regex", "1"); else params.delete("regex");

    if (s.activeFilters.size > 0) {
      const sortedFilters = Array.from(s.activeFilters).sort();
      params.set("filters", sortedFilters.join(","));
    } else {
      params.delete("filters");
    }

    const queryString = params.toString();
    const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, "", newUrl);
    }
  }
};

// ==========================================
// 8. UI LOGIC
// ==========================================
const UI = {
  /** @type {IntersectionObserver | null} */
  observer: null,

  init() {
    this.generateFilters();
    this.initObserver();
    this.render();

    // Bindings
    App.dom.inputSearch.addEventListener("input", e => {
      const val = (/** @type {HTMLInputElement} */ (e.target)).value;
      App.state.search = val;
      App.dom.clearBtn.style.display = val.length > 0 ? "flex" : "none";
      this.render();
    });

    App.dom.clearBtn.addEventListener("click", () => {
      App.state.search = "";
      App.dom.inputSearch.value = "";
      App.dom.clearBtn.style.display = "none";
      App.dom.inputSearch.focus();
      this.render();
    });

    App.dom.selectSort.addEventListener("change", e => {
      App.state.sort = (/** @type {HTMLSelectElement} */ (e.target)).value;
      this.render();
    });

    App.dom.selectView.addEventListener("change", e => {
      App.state.view = /** @type {"list" | "grid"} */ (/** @type {HTMLSelectElement} */ (e.target).value);
      this.render();
    });

    App.dom.regexBtn.addEventListener("click", () => {
      App.state.regexMode = !App.state.regexMode;
      App.dom.regexBtn.classList.toggle("active", App.state.regexMode);
      this.render();
    });

    App.dom.headerCheck.addEventListener("change", e =>
        Actions.toggleSelectAll((/** @type {HTMLInputElement} */ (e.target)).checked)
    );

    App.dom.mobileFilterBtn.addEventListener("click", () => {
      this.showMobileFilterPopover();
    });

    // Selection Bar
    App.dom.sbChips.forEach(chip => {
      chip.addEventListener("click", () => {
        App.state.actionMode = (/** @type {any} */ (chip.dataset)).mode;
        App.dom.sbChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      });
    });

    App.dom.sbPathInput.value = App.state.icontoolPath;
    App.dom.sbPathInput.addEventListener("input", (e) => {
      const val = (/** @type {HTMLInputElement} */ (e.target)).value;
      App.state.icontoolPath = val;
      localStorage.setItem("icontoolPath", val);
    });

    App.dom.sbClearBtn.addEventListener("click", () => Actions.toggleSelectAll(false));
    App.dom.sbDownloadBtn.addEventListener("click", () => Actions.downloadBundle());

    // Sort Headers
    const headers = {
      '.col.name': 'name',
      '.col.req': 'req',
      '.col.install': 'install',
      '.col.first': 'time'
    };
    Object.entries(headers).forEach(([selector, key]) => {
      const el = /** @type {HTMLElement} */ (App.dom.listHeader.querySelector(selector));
      if (el) {
        el.title = "Click to sort";
        el.onclick = () => Actions.toggleSortHeader(key);
      }
    });

    // Event Delegation
    App.dom.container.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      const trigger = target.closest('.ctx-trigger');
      if (trigger) {
        e.stopPropagation();
        const row = /** @type {HTMLElement} */ (trigger.closest('[data-id]'));
        const id = row.dataset.id;
        const app = App.state.idMap.get(id);
        if (app) this.showRowMenu(e, app);
        return;
      }

      if (target.closest('a')) {
        e.stopPropagation();
        return;
      }

      const item = /** @type {HTMLElement} */ (target.closest('[data-id]'));
      if (item) {
        Actions.toggleSelection(item.dataset.id, /** @type {MouseEvent} */ (e));
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((/** @type {HTMLElement} */ (e.target)).tagName === 'INPUT') return;

      // 1. Focus Search (/ or Ctrl + K)
      if (e.key === '/' || (e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        App.dom.inputSearch.focus();
      }

      // 2. Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        Actions.toggleSelectAll(true);
      }

      // 3. Clear Selection (Esc)
      if (e.key === 'Escape') {
        if (App.state.selected.size > 0) Actions.toggleSelectAll(false);
      }

      // 4. Focus selection bar (Ctrl + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (App.state.selected.size > 0) {
          e.preventDefault();
          App.dom.sbDownloadBtn.focus()
          App.dom.sbDownloadBtn.click()
        }
      }
    });

    // Add 'keydown' listener to container
    App.dom.container.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (!target) return;

      // --- 1. Selection & Actions (Enter/Space) ---
      if (!(e.ctrlKey || e.metaKey) && e.key === 'Enter' || e.key === ' ') {
        // A. Row/Card Selection
        if (target.classList.contains('list-row') || target.classList.contains('grid-card')) {
          e.preventDefault(); // Prevent page scroll on Space
          const id = target.dataset.id;
          if (!id) return;
          Actions.toggleSelection(id, e); // Pass event for Shift logic
        }

        // B. Context Menu Trigger
        if (target.classList.contains('ctx-trigger')) {
          e.preventDefault();
          e.stopPropagation();
          const row = /** @type {HTMLElement | null} */ (target.closest('[data-id]'));
          if (!row) return;
          const id = row.dataset.id;
          if (!id) return;
          const app = App.state.idMap.get(id);
          if (!app) return;

          const rect = target.getBoundingClientRect();
          const fakeEvent = {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          };

          UI.showRowMenu(fakeEvent, app);
        }
        return; // Done with Enter/Space
      }

      // --- 2. Navigation (Arrow Keys) ---
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const item = /** @type {HTMLElement | null} */ (target.closest('[data-id]'));
        if (!item) return;

        e.preventDefault(); // Prevent scrolling

        // Get only valid items (ignore loaders/sentinels)
        const items = /** @type {HTMLElement[]} */ (Array.from(App.dom.container.querySelectorAll('[data-id]')));
        const index = items.indexOf(item);
        let nextIndex = index;

        if (App.state.view === 'list') {
          // List: Up/Down only
          if (e.key === 'ArrowUp') nextIndex = index - 1;
          if (e.key === 'ArrowDown') nextIndex = index + 1;
        } else {
          // Grid: Calculate columns dynamically
          const itemWidth = item.getBoundingClientRect().width + 16; // Width + Gap
          const containerWidth = App.dom.container.clientWidth;
          const cols = Math.floor(containerWidth / itemWidth) || 1;

          if (e.key === 'ArrowLeft') nextIndex = index - 1;
          if (e.key === 'ArrowRight') nextIndex = index + 1;
          if (e.key === 'ArrowUp') nextIndex = index - cols - 1;
          if (e.key === 'ArrowDown') nextIndex = index + cols + 1;
        }

        // Apply Focus if valid
        if (nextIndex >= 0 && nextIndex < items.length) {
          items[nextIndex].focus();
        }
      }
    });

    // Menu Navigation
    const menus = ['rowMenu', 'mobileFilterMenu'];
    menus.forEach(id => {
      const menu = /** @type {HTMLElement} */ (App.dom[/** @type {keyof typeof App.dom} */ (id)]);
      if (!menu) return;

      if (menu) {
        // @ts-ignore
        menu.addEventListener("toggle", (e) => {
          if (e.newState === "closed") {
            // Wait for CSS transition
            setTimeout(() => menu.innerHTML = "", 200);
          }
        });
      }

      menu.addEventListener('keydown', (e) => {
        const items = /** @type {HTMLElement[]} */ (Array.from(menu.querySelectorAll('.ctx-item')));
        const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = items[index + 1] || items[0];
          next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = items[index - 1] || items[items.length - 1];
          prev.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (/** @type {HTMLElement} */ (document.activeElement)).click();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.closeContextMenu();
        }
      });
    });

    // Auto Focus
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) App.dom.inputSearch.focus();
  },

  initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const more = this.loadMore();
        App.dom.sentinel.style.opacity = more ? "1" : "0";
      }
    }, {rootMargin: "400px"});
    this.observer.observe(App.dom.sentinel);
  },

  render() {
    const s = App.state;
    App.dom.container.innerHTML = "";
    App.dom.container.className = s.view === "grid" ? "grid-container" : "";

    Data.process();
    Data.syncUrlState();
    this.updateHeader();

    if (s.currentData.length === 0) {
      App.dom.container.innerHTML = Templates.emptyState();
      this.updateHeader();
      return;
    }

    s.renderedCount = 0;
    this.loadMore();

    App.dom.listHeader.style.display = s.view === "list" ? "grid" : "none";
  },

  /**
   * @returns {boolean}
   */
  loadMore() {
    const s = App.state;
    if (s.renderedCount >= s.currentData.length) return false;

    const end = Math.min(s.renderedCount + CONFIG.ui.batchSize, s.currentData.length);
    const batch = s.currentData.slice(s.renderedCount, end);
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');

    batch.forEach(app => {
      const id = app.componentName;
      const isSelected = s.selected.has(id);
      const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;

      let html;
      const tags = Utils.getTagsForApp(id);
      if (s.view === "list") {
        html = Templates.listRow(app, isSelected, tags, iconUrl, Utils.formatDate(app.firstAppearance), Utils.formatDate(app.lastRequested));
      } else {
        html = Templates.gridCard(app, tags, isSelected, iconUrl);
      }

      tempDiv.innerHTML = html.trim();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    });

    App.dom.container.appendChild(fragment);
    s.renderedCount = end;
    return true;
  },

  generateFilters() {
    const c = App.dom.filterBox;
    if (!c) return;
    c.innerHTML = "";

    CONFIG.data.filters.forEach(id => {
      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const btn = document.createElement("button");
      btn.className = `tag tag-${id} chip`;
      btn.textContent = meta.label;
      btn.title = meta.description || `Filter by ${meta.label}`;
      if (App.state.activeFilters.has(id)) btn.classList.add("active");

      btn.onclick = () => {
        const s = App.state.activeFilters;

        Utils.mutualExclusiveTags(id, s)
        // Update UI classes immediately (faster than full render)
        Array.from(c.children).forEach(b => {
          // @ts-ignore
          const filterId = b.className.match(/tag-([a-z]+)/)[1];

          if (s.has(filterId)) b.classList.add("active");
          else b.classList.remove("active");
        });

        this.render()
      };
      c.appendChild(btn);
    });
  },

  /**
   * @param {string} id
   */
  updateItemVisuals(id) {
    const isSelected = App.state.selected.has(id);
    document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
      el.classList.toggle("selected", isSelected);
      const cb = /** @type {HTMLInputElement} */ (el.querySelector("input[type='checkbox']"));
      if (cb) cb.checked = isSelected;
    });
  },

  updateHeader() {
    const total = App.state.currentData.length;
    const absTotal = App.data.length;

    // Text
    const countEl = App.dom.headerCount;
    if (total === absTotal) {
      countEl.textContent = `${absTotal.toLocaleString()} requests`;
    } else {
      countEl.textContent = `${total.toLocaleString()} of ${absTotal.toLocaleString()} requests`;
    }

    // Checkbox
    const hc = App.dom.headerCheck;
    if (total === 0) {
      hc.checked = false;
      hc.indeterminate = false;
      return;
    }

    let count = 0;
    App.state.currentData.forEach(app => {
      if (App.state.selected.has(app.componentName)) count++;
    });

    hc.checked = (count === total);
    hc.indeterminate = (count > 0 && count < total);

    const filterCount = App.state.activeFilters.size;
    if (filterCount > 0) {
      App.dom.mobileFilterCount.textContent = `(${filterCount})`;
    } else {
      App.dom.mobileFilterCount.textContent = "";
    }

    this.updateSelectionBar();
  },

  updateSelectionBar() {
    const count = App.state.selected.size;
    const bar = App.dom.sbBar;

    if (count > 0) {
      bar.classList.add("visible");
      App.dom.sbCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
    } else {
      bar.classList.remove("visible");
    }
  },

  /**
   * @param {any} e
   * @param {AppEntry} app
   */
  showRowMenu(e, app) {
    App.dom.rowMenu.innerHTML = Templates.rowMenu(app);

    const w = 255, h = 290;
    let x = e.clientX + 2, y = e.clientY + 2;
    if (x + w > window.innerWidth) x -= (w + 4);
    if (y + h > window.innerHeight) y -= (h + 4);

    App.dom.rowMenu.style.left = `${x}px`;
    App.dom.rowMenu.style.top = `${y}px`;
    App.dom.rowMenu.style.transformOrigin = "top left";
    /** @type {any} */ (App.dom.rowMenu).showPopover();
    this.focusMenu(App.dom.rowMenu);
  },

  showMobileFilterPopover() {
    const menu = App.dom.mobileFilterMenu;
    menu.innerHTML = "";
    const s = App.state.activeFilters;

    CONFIG.data.filters.forEach(id => {
      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const item = document.createElement("div");
      const isActive = s.has(id);
      item.tabIndex = 0;
      item.role = "menuitemcheckbox";
      item.className = `ctx-item ${isActive ? 'active' : ''}`;

      item.innerHTML = `
        <span class="check-icon">${ICONS.check}</span>
        <span>${meta.label}</span>      
      `;

      item.onclick = (e) => {
        e.stopPropagation();

        Utils.mutualExclusiveTags(id, s)
        UI.render();

        // Re-render menu content to update checkmarks instantly
        this.showMobileFilterPopover();
      };
      menu.appendChild(item);
    });

    const rect = App.dom.mobileFilterBtn.getBoundingClientRect();
    const padding = (s.size > 0) ? 135 : 150;

    menu.style.left = `${rect.left - padding}px`;
    menu.style.top = `${rect.bottom + 8}px`;

    /** @type {any} */ (menu).showPopover();
    this.focusMenu(menu);
  },

  /**
   * @param {HTMLElement} menuEl
   */
  focusMenu(menuEl) {
    // Wait for browser to render the popover
    requestAnimationFrame(() => {
      const firstItem = /** @type {HTMLElement} */ (menuEl.querySelector('.ctx-item'));
      if (firstItem) firstItem.focus();
    });
  },

  closeContextMenu() {
    try { /** @type {any} */ (App.dom.rowMenu).hidePopover(); } catch {}
    try { /** @type {any} */ (App.dom.mobileFilterMenu).hidePopover(); } catch {}

    setTimeout(() => {
      App.dom.rowMenu.innerHTML = "";
      App.dom.mobileFilterMenu.innerHTML = "";
    }, 200);
  }
};

// Start
Data.init();
