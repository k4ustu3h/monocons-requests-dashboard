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
 * @property {Object | null} geoBatchConfig
 * @property {Map<string, string>} existingSvgs
 * @property {Object} setsStats
 * @property {Array} creationOdds
 * @property {Object} domainStats
 * @property {Array} activityStats
 * @property {Object} trendingDeltas
 * @property {string | null} lastUpdate
 * @property {string} icontoolPath
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = {
  data: {
    endpoint: "assets/requests.json",
    setsStatsPath: "assets/sets_stats.json",
    creationOddsPath: "assets/creation_odds.json",
    domainStatsPath: "assets/domain_stats.json",
    activityStatsPath: "assets/activity_stats.json",
    assetsPath: "extracted_png/",
    iconExtension: ".png",
    filterPath: "assets/filters/",
    // Order matters for UI
    filters: ["wip", "supported", "easy", "nameinuse", "match", "stale", "unlabeled"]
  },
  label_factors: {
    stale: 0.1,
    unlabeled: 1,
    nameinuse: 2,
    easy: 3,
    match: 5,
    supported: 6,
    wip: 8,
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
    geoBatchConfig: null,
    existingSvgs: new Map(),
    setsStats: {},
    creationOdds: [],
    domainStats: {},
    domainStatsMode: "requests",
    activityStats: [],
    trendingDeltas: {},
    lastUpdate: null,

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
    /** @type {HTMLButtonElement} */
    sbDownloadBtn: /** @type {any} */ (document.getElementById("sbDownloadBtn")),
    /** @type {HTMLButtonElement} */
    sbMenuBtn: /** @type {any} */ (document.getElementById("sbMenuBtn")),
    /** @type {HTMLElement} */
    rowMenu: /** @type {any} */ (document.getElementById("rowMenu")),
    /** @type {HTMLDivElement} */
    toastBox: /** @type {any} */ (document.getElementById("toastContainer")),
    /** @type {HTMLButtonElement} */
    geoBatchBtn: /** @type {any} */ (document.getElementById("geoBatchBtn")),
    /** @type {HTMLButtonElement} */
    geoBatchMenu: document.getElementById("geoBatchMenu"),
    /** @type {HTMLButtonElement} */
    sortBtn: /** @type {any} */ (document.getElementById("sortBtn")),
    /** @type {HTMLButtonElement} */
    viewBtn: /** @type {any} */ (document.getElementById("viewBtn")),
    /** @type {HTMLElement} */
    viewIconList: document.getElementById("viewIconList"),
    /** @type {HTMLElement} */
    viewIconGrid: document.getElementById("viewIconGrid"),
    /** @type {HTMLElement} */
    sortMenu: /** @type {any} */ (document.getElementById("sortMenu")),
    /** @type {HTMLSpanElement} */
    sortLabel: /** @type {any} */ (document.getElementById("sortLabel"))
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
    const result = { text: "", tags: new Set() };
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
   * @returns {number}
   */
  getCreationOdds(app) {
    const table = App.state.creationOdds;
    if (!table || table.length === 0) return 0;
    const pkg = app.componentName.split('/')[0];
    const pop = App.state.setsStats[pkg] || app.requestCount;
    const row = table.find(r => r.popularity === pop);
    if (!row) return 0;
    const tags = Utils.getTagsForApp(app.componentName);
    let factor = null;
    for (const tag of tags) {
      const f = CONFIG.label_factors[tag];
      if (f !== undefined && (factor === null || f > factor)) factor = f;
    }
    if (factor === null) factor = 1;
    return row[factor] || 0;
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

  /**
   * @param {string} dateStr
   * @returns {string}
   */
  timeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr + "T00:00:00");
    const diff = now - then;
    const days = Math.floor(diff / 86400000);
    if (days > 30) {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (days === 0) return "today";
    if (days === 1) return "1d";
    return `${days}d`;
  },

  /**
   * @param {number} num
   * @returns {string}
   */
  compactNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  },

  /**
   * @param {Element | null | undefined} element
   * @param {boolean} hidden
   */
  setHidden(element, hidden) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;
    element.classList.toggle("is-hidden", hidden);
  },

  /**
   * @param {Event} event
   */
  handleImageError(event) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;

    const errorMode = target.dataset.errorMode;
    if (errorMode === "hide-wrapper") {
      target.closest(".existing-svg-wrapper")?.classList.add("is-hidden");
      return;
    }

    target.classList.add("is-hidden");

    if (errorMode === "show-next-fallback") {
      const fallback = target.nextElementSibling;
      if (fallback instanceof HTMLElement) {
        fallback.classList.remove("is-hidden");
      }
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
    const existingDrawable = App.state.existingSvgs ? App.state.existingSvgs.get(id) : null;
    const appNameClass = isUnknown ? "app-name is-hidden" : "app-name";

    const tagHtml = tags.map(tagId => {
      const meta = App.state.filterMetadata.get(tagId);
      const label = meta ? meta.label : tagId;
      const desc = meta ? meta.description : "";
      return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
    }).join("");

    const existingSvgHtml = existingDrawable
      ? `<span class="existing-svg-wrapper">
         <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${existingDrawable}.svg" 
              class="existing-svg" 
              title="${existingDrawable}.svg"
              loading="lazy"
        data-error-mode="hide-wrapper" />
       </span>`
      : "";

    const iconHtml = isUnknown
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" class="requested-icon" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
         <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    const installsRaw = app.installs ? app.installs.replace(/[,+]/g, '') : null;
    const displayInstalls = installsRaw ? new Intl.NumberFormat('en', { notation: "compact" }).format(parseInt(installsRaw)) + "+" : "—";
    const rawOdds = Utils.getCreationOdds(app) * 100;
    const displayOdds = rawOdds < 1 ? rawOdds.toFixed(2) + "%" : rawOdds.toFixed(0) + "%";
    const trendingDelta = App.state.trendingDeltas[app.componentName];

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
          <div class="name-content">
            ${existingSvgHtml}
          <div class="name-details">
              <div class="name-row">
                  ${tagHtml}
                  <span class="${appNameClass}">${name}</span>
              </div>
              <span class="pkg-name" title="${id}">${id}</span>
          </div>
          </div>
        </div>
        <div class="col req">${(App.state.setsStats[pkg] || app.requestCount).toLocaleString()}${trendingDelta ? ` <span class="trend-indicator" title="Growth during last request period.">↑${trendingDelta}</span>` : ""}</div>
        <div class="col creation-odds" title="Chance of this request being fulfilled within a year if you wait.">${displayOdds}</div>
        <div class="col install" title="${app.installs || '0'} installs in Play Store">${displayInstalls}</div>
        <div class="col first date-col">
          <div>${firstStr}</div>
          <div>Last: ${lastStr}</div>
        </div>
        <div class="actions-col">
          <a class="action-btn" href="${iconUrl}" download title="Download PNG"
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
          <div class="fallback-icon-grid-title">No Icon</div>
          <div class="fallback-icon-grid-label">${label}</div>
        </div>
      `;
    } else {
      contentHtml = `<img src="${iconUrl}" loading="lazy" data-error-mode="show-next-fallback" alt="${label}" />
      <div class="fallback-icon-grid is-hidden">No Icon</div>`;
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
          <input type="checkbox" ${isSelected ? "checked" : ""} tabindex="-1">
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

    return `
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.fDroid}${pkg}">
        ${ICONS.fDroid} <span>F-Droid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.izzy}${pkg}">
        ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.galaxyStore}${pkg}">
        ${ICONS.galaxyStore} <span>Galaxy Store</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">Copy</div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-appfilter-entry" data-id="${id}">
        <span>appfilter.xml</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-name-id-entry" data-id="${id}">
        <span>name & app ID</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-pkg-entry" data-id="${id}">
        <span>package name</span>
      </div>
      </div>
    `;
  },

  /**
   * @param {{ value: string, label: string }[]} options
   * @param {string} activeValue
   * @returns {string}
   */
  sortMenuItems(options, activeValue) {
    return options.map(opt => `
      <div class="ctx-item ${activeValue === opt.value ? 'active' : ''}" tabindex="0" role="menuitemradio" aria-checked="${activeValue === opt.value}" data-action="sort-option" data-value="${opt.value}">
        <span>${opt.label}</span>
      </div>
    `).join("");
  },

  /**
   * @param {{ value: string, label: string }[]} options
   * @param {string} activeValue
   * @returns {string}
   */
  viewMenuItems(options, activeValue) {
    return options.map(opt => `
      <div class="ctx-item ${activeValue === opt.value ? 'active' : ''}" tabindex="0" role="menuitemradio" aria-checked="${activeValue === opt.value}" data-action="view-option" data-value="${opt.value}">
        <span>${opt.label}</span>
      </div>
    `).join("");
  },

  /**
   * @param {string} domainsText
   * @param {string} targetText
   * @returns {string}
   */
  geoBatchConfig(domainsText, targetText) {
    return `
      <div class="domain-config">
        <div class="input-wrapper">
          <input id="geoBatchDomains" type="text" value="${domainsText}" placeholder="Domains: de 2, jp 3, br 1" />
        </div>
        <div class="domain-config-row">
          <div class="input-wrapper">
            <input id="geoBatchTarget" type="text" inputmode="numeric" pattern="[0-9]*" value="${targetText}" disabled />
          </div>
          <button class="domain-config-btn-apply" id="geoBatchApply" data-action="geo-batch-apply">Apply</button>
        </div>
      </div>
    `;
  },

  /**
   * @param {[string, number][]} entries
   * @param {number} max
   * @returns {string}
   */
  domainStatsCard(entries, max) {
      return `<div class="card-chart has-bars">
        ${entries.map(([domain, done, requests, total]) => {
          const shortDomain = domain.length > 3 ? domain.slice(0, 3) : domain;
          const doneH = (done / max * 100).toFixed(0);
          const reqH = (requests / max * 100).toFixed(0);
          return `<div class="domain-col" data-action="domain-filter" data-domain="${domain}" data-done="${done}" data-requests="${requests}" data-total="${total}">
            <div class="domain-col-fill domain-col-requests" style="height:${reqH}%"></div>
            <div class="domain-col-fill domain-col-done" style="height:${doneH}%"></div>
            <span class="chart-label">${shortDomain}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="chart-tooltip"></div>`;
  },
  /**
   * @param {string} domain
   * @param {string} count
   * @returns {string}
   */
  domainStatsTooltip(domain, done, requests, total, mode, extraValue, population) {
      const pct = total ? (done / total * 100).toFixed(1) : 0;
      let extra = "";
      if (mode === "local" && extraValue) {
          extra = `<div class="tooltip-value">avg ${Utils.compactNumber(extraValue)} installs</div>`;
      } else if (mode === "coverage") {
          extra = `<div class="tooltip-value">${((requests / total) * 100).toFixed(1)}% uncovered</div>`;
      }
      return `<div class="tooltip-label">${domain}</div>
        <div class="tooltip-value">${requests} requests</div>
        <div class="tooltip-value">${done} done (${pct}%)</div>${extra}`;
  },
  /**
   * @param {string} pathNew
   * @param {string} pathRemoved
   * @param {string} dayLabels
   * @returns {string}
   */
  activityCard(pathNew, pathRemoved, dayLabels) {
    return `<div class="card-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="activity-svg">
        <line x1="0" y1="50" x2="100" y2="50" class="activity-zero" />
        <path d="${pathNew}" class="activity-line activity-new" />
        <path d="${pathRemoved}" class="activity-line activity-removed" />
      </svg>
      <div class="activity-days">${dayLabels}</div>
    </div>
    <div class="chart-tooltip"></div>`;
  },

  /**
   * @returns {string}
   */
  activityCardEmpty() {
    return `<div class="card-chart card-chart-empty">Collecting data…</div>`;
  },

  /**
   * @param {string} formattedDate
   * @param {number} added
   * @param {number} removed
   * @returns {string}
   */
  activityTooltip(formattedDate, added, removed) {
    return `<div class="tooltip-label">${formattedDate}</div><div class="tooltip-value tooltip-value-primary">+${added} new</div><div class="tooltip-value tooltip-value-error">−${removed} resolved</div>`;
  },

  /**
   * @param {string} id
   * @param {string} label
   * @param {boolean} isActive
   * @returns {string}
   */
  mobileFilterItem(id, label, isActive) {
    return `
      <div class="ctx-item ${isActive ? 'active' : ''}" data-action="mobile-filter-toggle" data-filter-id="${id}" tabindex="0" role="menuitemcheckbox" aria-checked="${isActive}">
        <span class="check-icon">${ICONS.check}</span>
        <span>${label}</span>
      </div>
    `;
  },

  /**
   * @returns {string}
   */
  selectionBarMenu() {
    return `
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-download-metadata">
        ${ICONS.download} <span>Download metadata</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">Copy</div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-appfilter">
        <span>appfilter.xml</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-nameid">
        <span>names and app IDs</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-pkgs">
        <span>package names</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-pr-new">
        <span>PR body (new icons)</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-pr-link">
        <span>PR body (links)</span>
      </div>
    `;
  },

  /**
   * @param {string[]} matches
   * @returns {string}
   */
  regexAutocompleteList(matches) {
    return matches.map(domain => `
      <div class="autocomplete-item" tabindex="0" role="option" data-action="regex-suggestion" data-value="^${domain}\\.">^${domain}\\.</div>
    `).join("");
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
      if (first) this.remove(/** @type {HTMLElement} */(first));
    }

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.dataset.key = key;
    this.activeToasts.add(key);

    let iconSvg = ICONS.copy;
    if (type === "error") iconSvg = `<svg><use href="#ic-error"/></svg>`; // Using search as alert icon placeholder
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

    const defaults = {
      name: 'asc',
      req: 'desc',
      odds: 'desc',
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
    const opt = UI.sortOptions.find(o => o.value === nextSort);
    App.dom.sortLabel.textContent = opt ? opt.label : nextSort;
    UI.render();
  },

  clearAllSelections() {
    if (App.state.selected.size === 0) return;
    document.querySelectorAll(".list-row.selected, .grid-card.selected").forEach(el => {
      el.classList.remove("selected");
      const cb = el.querySelector("input[type='checkbox']");
      if (cb) cb.checked = false;
    });
    App.state.selected.clear();
    App.state.lastSelectedId = null;
    UI.updateHeader();
    UI.updateSelectionBar();
  },

  closeSbMenu() {
    document.getElementById("sbMenu")?.hidePopover();
  },

  generateNamesAndIDs(ids = null) {
    const apps = ids
      ? ids.map(id => App.state.idMap.get(id)).filter(Boolean)
      : App.data.filter(a => App.state.selected.has(a.componentName));
    return apps.map(app => `${app.label}\n${app.componentName}`).join("\n\n");
  },

  copyNamesAndIDs(ids = null) {
    Actions.copyToClipboard(Actions.generateNamesAndIDs(ids));
  },

  copyPkgName(id) {
      const app = App.state.idMap.get(id);
      if (!app) return;
      Actions.copyToClipboard(app.componentName.split('/')[0]);
  },

  copySelectedPkgs() {
      const pkgs = [...App.state.selected]
          .map(id => App.state.idMap.get(id))
          .filter(Boolean)
          .map(app => app.componentName.split('/')[0]);
      Actions.copyToClipboard([...new Set(pkgs)].join("\n"));
      Actions.closeSbMenu();
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
    Actions.copyToClipboard(Actions.generateAppFilterXml([id]));
  },

  generateAppFilterXml(ids = null) {
    const apps = ids
      ? ids.map(id => App.state.idMap.get(id)).filter(Boolean)
      : App.data.filter(a => App.state.selected.has(a.componentName));
    let xml = "<resources>\n";
    apps.forEach(app => {
      xml += `    ${Utils.generateXml(app)}\n`;
    });
    xml += "</resources>";
    return xml;
  },

  copyAppFilter() {
    Actions.copyToClipboard(Actions.generateAppFilterXml());
  },

  generatePRDescription(mode) {
    const selected = App.data.filter(a => App.state.selected.has(a.componentName));
    let md = `## Icons\n`;
    if (mode === "new") {
      md += "### Added\n";
      selected.forEach(app => {
        md += `${app.label} (\`${app.componentName.split('/')[0]}\`)\n`;
      });
    } else {
      md += "### Linked\n";
      selected.forEach(app => {
        const drawable = Utils.sanitizeDrawableName(app.label);
        md += `${app.label} (\`${app.componentName.split('/')[0]}\` → \`${drawable}.svg\`)\n`;
      });
    }
    return md;
  },

  copyPRDescription(mode) {
    Actions.copyToClipboard(Actions.generatePRDescription(mode));
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
    App.dom.sbDownloadBtn.textContent = "Processing...";
    document.body.style.cursor = "wait";

    try {
      const mode = App.state.actionMode; // "new" | "link"

      // fflate uses a simple object mapping paths to Uint8Arrays/Strings
      /** @type {Object.<string, Uint8Array | string | Object>} */
      const zipData = {};

      // Only include icons folder in "new" mode
      if (mode === "new") {
        zipData["_icons"] = {};
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
        const cmdType = mode === "new" ? "add" : "link";
        const svgPath = mode === "new" ? `"${drawable}.svg"` : `"${drawable}"`;
        txtCommands += `python3 ./icontool.py ${cmdType} ${svgPath} ${cmp} "${cmdLabel}"\n`;

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
        if (mode === "new" && !zipData._icons[`${drawable}.png`]) {
          const url = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
          const p = fetch(url)
            .then(r => r.ok ? r.arrayBuffer() : null)
            .then(buf => {
              if (buf) zipData._icons[`${drawable}.png`] = new Uint8Array(buf);
            })
            .catch(() => { });
          fetchPromises.push(p);
        }
      });

      // --- FINALIZE OUTPUTS ---
      App.dom.sbDownloadBtn.textContent = "Fetching...";
      await Promise.all(fetchPromises);

      // 1. XML
      xmlAppFilter += "</resources>";
      zipData["appfilter.xml"] = fflate.strToU8(xmlAppFilter);

      // 2. Config
      const filterConfig = {
        "label": "Selection",
        "description": "Sample description",
        "selection": selectedApps.map(a => a.componentName)
      };
      zipData["filter_config.json"] = fflate.strToU8(JSON.stringify(filterConfig, null, 2));

      // 3. Commands
      if (txtCommands) {
        txtCommands = "Run from your Lawnicons repository folder.\n\n" + txtCommands;
        zipData["icontool_commands.txt"] = fflate.strToU8(txtCommands);
      }

      let mdPR = "## Icons\n\n";
      mdPR += (mode === "new" ? "### Added\n" : "### Linked\n");
      mdPR += Array.from(prLines).join("\n") + "\n";
      zipData["pr_description.md"] = fflate.strToU8(mdPR);

      // 6. Zip & Download
      App.dom.sbDownloadBtn.textContent = "Zipping...";
      const content = fflate.zipSync(zipData, { level: 6 });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([content], { type: 'application/zip' }));
      const date = new Date().toISOString().slice(5, 10); // MM-DD
      const name = mode === "new" ? `lawnicons-add-icons-${date}` : `lawnicons-link-app-ids-${date}`;
      link.download = `${name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

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
      fetch(CONFIG.data.setsStatsPath).then(r => r.json()).catch(() => ({})),
      fetch(CONFIG.data.creationOddsPath).then(r => r.json()).catch(() => []),
      fetch(CONFIG.data.domainStatsPath).then(r => r.json()).catch(() => ({})),
      fetch(CONFIG.data.activityStatsPath).then(r => r.json()).catch(() => []),
      ...CONFIG.data.filters.map(id => this.fetchFilterData(id))
    ])
      .then(([json, setsStats, creationOdds, domainStats, activityStats, ...filterObjects]) => {
        App.data = json.apps;
        App.state.setsStats = setsStats;
        App.state.creationOdds = creationOdds;
        App.state.domainStats = domainStats;
        App.state.activityStats = activityStats;
        App.state.lastUpdate = json.lastUpdate;

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
            obj[id].forEach(item => {
              const appId = typeof item === 'string' ? item : item.id;
              this.addTag(appId, id);
              if (typeof item === 'object' && item.existing_drawable) {
                if (!App.state.existingSvgs) App.state.existingSvgs = new Map();
                App.state.existingSvgs.set(appId, item.existing_drawable);
              }
            });
          }
        });

        // Load optional data, then init UI
        Promise.all([
          fetch("assets/fulfillment_history.json").then(r => r.json()).catch(() => []),
          fetch("assets/trending_baseline.json").then(r => r.json()).catch(() => null)
        ]).then(([history, baseline]) => {
          if (history && history.length > 0) {
              const ttfs = history.map(h => (h.fulfilled - h.firstAppearance) / 86400);
              ttfs.sort((a,b) => a-b);
              const median = ttfs[Math.floor(ttfs.length / 2)];
              App.state.medianTTF = Math.round(median);
          }
          if (baseline && baseline.period_start && baseline.period_end) {
              const startSnapshot = baseline.period_start.snapshot || {};
              const endSnapshot = baseline.period_end.snapshot || {};
              App.state.trendingDeltas = {};
              for (const [comp, endCount] of Object.entries(endSnapshot)) {
                  const startCount = startSnapshot[comp] || 0;
                  const delta = endCount - startCount;
                  if (delta > 0) {
                      App.state.trendingDeltas[comp] = delta;
                  }
              }
          }
        }).catch(() => {}).finally(() => {
          this.loadUrlState();
          UI.init();
          UI.buildQuickPickQueue();
          UI.renderQuickPick();
        });
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
        description: "Requests with medium to high complexity.",
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
        "req-desc": (a, b) => {
          const pkgA = a.componentName.split('/')[0];
          const pkgB = b.componentName.split('/')[0];
          const valA = App.state.setsStats[pkgA] || a.requestCount;
          const valB = App.state.setsStats[pkgB] || b.requestCount;
          return valB - valA;
        },
        "req-asc": (a, b) => {
          const pkgA = a.componentName.split('/')[0];
          const pkgB = b.componentName.split('/')[0];
          const valA = App.state.setsStats[pkgA] || a.requestCount;
          const valB = App.state.setsStats[pkgB] || b.requestCount;
          return valA - valB;
        },
        "trending": (a, b) => {
          const deltaA = App.state.trendingDeltas[a.componentName] || 0;
          const deltaB = App.state.trendingDeltas[b.componentName] || 0;
          return deltaB - deltaA;
        },
        "odds-desc": (a, b) => Utils.getCreationOdds(b) - Utils.getCreationOdds(a),
        "odds-asc": (a, b) => Utils.getCreationOdds(a) - Utils.getCreationOdds(b),
        "install-desc": (a, b) => Utils.parseInstalls(b.installs) - Utils.parseInstalls(a.installs),
        "install-asc": (a, b) => Utils.parseInstalls(a.installs) - Utils.parseInstalls(b.installs),
        "name-asc": (a, b) => a.label.localeCompare(b.label),
        "name-desc": (a, b) => b.label.localeCompare(a.label),
        "time-desc": (a, b) => b.firstAppearance - a.firstAppearance,
        "time-asc": (a, b) => a.firstAppearance - b.firstAppearance
      };
      if (sorters[s.sort]) data.sort(sorters[s.sort]);
    }

    if (s.geoBatchConfig) {
      data = UI.applyGeoBatch(data);
    }

    App.state.currentData = data;
  },

  /**
   * @param {{ domainsRaw: string, target: string | null }} config
   * @returns {string}
   */
  serializeGeoBatch(config) {
    const parts = config.domainsRaw.split(",").map(s => s.trim()).filter(s => s);
    const encoded = parts.map(p => {
      const [domain, weight] = p.trim().split(/\s+/);
      if (!domain || !weight) return null;
      return `${domain}:${weight}`;
    }).filter(Boolean).join(",");
    if (!encoded) return "";
    return config.target ? `${encoded}/${config.target}` : encoded;
  },

  /**
   * @param {string} str
   * @returns {{ domainsRaw: string, target: string | null } | null}
   */
  parseGeoBatchParam(str) {
    if (!str) return null;
    try {
      const slashIdx = str.indexOf("/");
      const domainsPart = slashIdx !== -1 ? str.slice(0, slashIdx) : str;
      const targetPart = slashIdx !== -1 ? str.slice(slashIdx + 1) : null;
      const pairs = domainsPart.split(",").map(p => p.trim()).filter(p => p);
      if (!pairs.length) return null;
      const domainItems = pairs.map(p => {
        const colonIdx = p.indexOf(":");
        if (colonIdx === -1) return null;
        const domain = p.slice(0, colonIdx).trim();
        const weight = p.slice(colonIdx + 1).trim();
        if (!domain || !weight || isNaN(parseInt(weight))) return null;
        return `${domain} ${weight}`;
      }).filter(Boolean);
      if (!domainItems.length) return null;
      return { domainsRaw: domainItems.join(", "), target: targetPart || null };
    } catch {
      return null;
    }
  },

  loadUrlState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) {
      App.state.search = params.get("q") || "";
      App.dom.inputSearch.value = App.state.search;
      Utils.setHidden(App.dom.clearBtn, !App.state.search);
    }
    if (params.has("view")) {
      const v = params.get("view");
      if (v === "list" || v === "grid") App.state.view = v;
    }
    if (params.has("sort")) {
      App.state.sort = params.get("sort") || DEFAULTS.sort;
      const opt = UI.sortOptions.find(o => o.value === App.state.sort);
      App.dom.sortLabel.textContent = opt ? opt.label : App.state.sort;
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
    if (params.has("geo")) {
      const config = Data.parseGeoBatchParam(params.get("geo") || "");
      if (config) App.state.geoBatchConfig = config;
    }
  },

  syncUrlState() {
    const s = App.state;
    const params = new URLSearchParams(window.location.search);

    if (s.search) params.set("q", s.search); else params.delete("q");
    if (s.view !== DEFAULTS.view) params.set("view", s.view); else params.delete("view");
    if (s.sort !== DEFAULTS.sort) params.set("sort", s.sort); else params.delete("sort");
    if (s.regexMode) params.set("regex", "1"); else params.delete("regex");
    if (s.geoBatchConfig) params.set("geo", Data.serializeGeoBatch(s.geoBatchConfig)); else params.delete("geo");

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

  /** @type {HTMLElement | null} */
  regexListEl: null,

  sortOptions: [
    { value: "req-desc", label: "Most requested" },
    { value: "req-asc", label: "Least requested" },
    { value: "odds-desc", label: "Highest creation odds" },
    { value: "odds-asc", label: "Lowest creation odds" },
    { value: "install-desc", label: "Most installed" },
    { value: "install-asc", label: "Least installed" },
    { value: "time-desc", label: "Newest" },
    { value: "time-asc", label: "Oldest" },
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "trending", label: "Trending" },
    { value: "rand", label: "Random" }
  ],

  init() {
    if (App.state.regexMode) {
      App.dom.regexBtn.classList.add("active");
      Utils.setHidden(App.dom.geoBatchBtn, true);
    }

    if (App.state.geoBatchConfig !== null) {
      App.dom.geoBatchBtn.classList.add("active");
      App.dom.regexBtn.style.display = "none";
    }

    this.renderDomainStats();
    document.querySelectorAll("[data-action='domain-stats-mode']").forEach(el => {
    el.addEventListener("click", () => {
        const mode = el.dataset.mode;
        if (!mode) return;
        App.state.domainStatsMode = mode;
        document.querySelectorAll("[data-action='domain-stats-mode']").forEach(s => {
            const span = s.closest('span');
            if (span) span.classList.toggle("active", s.dataset.mode === mode);
        });
        this.renderDomainStats();
        });
    });

    const activeMode = App.state.domainStatsMode;
    const activeSvg = document.querySelector(`[data-action='domain-stats-mode'][data-mode='${activeMode}']`);
    if (activeSvg) {
        const span = activeSvg.closest('span');
        if (span) span.classList.add("active");
    }    

    // Quick Pick
    this.renderQuickPick();
    
    document.getElementById("quickPickDownload")?.addEventListener("click", (e) => {
        e.preventDefault();
        const queue = App.state.quickPickMode === 'easy' 
            ? App.state._quickPickEasy 
            : App.state._quickPickMiddle;
        if (!queue || !queue.length) return;
        const app = queue[App.state._lastQuickPickIdx || 0];
        App.state.selected.clear();
        App.state.selected.add(app.componentName);
        Actions.downloadBundle();
    });

    document.querySelectorAll("[data-action='quick-pick-mode']").forEach(el => {
        el.addEventListener("click", () => {
            const mode = el.dataset.mode;
            if (!mode) return;
            App.state.quickPickMode = mode;
            document.querySelectorAll("[data-action='quick-pick-mode']").forEach(s => {
                const span = s.closest('span');
                if (span) span.classList.toggle("active", s.dataset.mode === mode);
            });
            this.pickRandomQuickPick();
        });
    })

    this.renderActivityCard();
    this.generateFilters();
    this.initObserver();
    this.initRegexAutocomplete();
    this.render();

    window.addEventListener("resize", () => {
      this.renderDomainStats();
      this.renderActivityCard();
    });

    // Bindings
    App.dom.container.addEventListener("error", event => {
      Utils.handleImageError(event);
    }, true);

    App.dom.inputSearch.addEventListener("input", e => {
      const val = (/** @type {HTMLInputElement} */ (e.target)).value;
      App.state.search = val;
      Utils.setHidden(App.dom.clearBtn, val.length === 0);
      this.render();
    });

    App.dom.clearBtn.addEventListener("click", () => {
      App.state.search = "";
      App.dom.inputSearch.value = "";
      Utils.setHidden(App.dom.clearBtn, true);
      App.dom.inputSearch.focus();
      if (App.state.geoBatchConfig === null) {
        App.dom.regexBtn.style.display = "";
      }
      this.render();
    });

    App.dom.sortBtn.addEventListener("click", () => this.showSortMenu());

    App.dom.viewBtn.addEventListener("click", () => {
      App.state.view = App.state.view === "list" ? "grid" : "list";
      App.dom.viewIconList.classList.toggle("active", App.state.view === "list");
      App.dom.viewIconGrid.classList.toggle("active", App.state.view === "grid");
      this.render();
    });

    App.dom.viewIconList.classList.add("active");
    App.dom.viewIconGrid.classList.remove("active");

    App.dom.regexBtn.addEventListener("click", () => {
      if (App.state.geoBatchConfig !== null) {
        App.state.geoBatchConfig = null;
        App.dom.geoBatchBtn.classList.remove("active");
        Utils.setHidden(App.dom.geoBatchBtn, false);
        this.render();
        return;
      }
      App.state.regexMode = !App.state.regexMode;
      App.dom.regexBtn.classList.toggle("active", App.state.regexMode);
      if (App.state.regexMode) {
        Utils.setHidden(App.dom.geoBatchBtn, true);
      } else {
        Utils.setHidden(App.dom.geoBatchBtn, false);
      }
      this.render();
    });

    App.dom.headerCheck.addEventListener("change", e =>
      Actions.toggleSelectAll((/** @type {HTMLInputElement} */ (e.target)).checked)
    );

    App.dom.mobileFilterBtn.addEventListener("click", () => {
      this.showMobileFilterPopover();
    });

    App.dom.geoBatchBtn.addEventListener("click", () => {
      if (App.state.geoBatchConfig !== null) {
        App.state.geoBatchConfig = null;
        App.dom.geoBatchBtn.classList.remove("active");
        App.dom.regexBtn.style.display = "";
        if (App.state.regexMode) {
          App.state.regexMode = false;
          App.dom.regexBtn.classList.remove("active");
        }
        this.render();
        return;
      }
      this.showGeoBatchConfig();
    });

    // Selection Bar
    App.dom.sbDownloadBtn.addEventListener("click", () => {
      App.state.actionMode = "new";
      Actions.downloadBundle();
    });

    App.dom.sbMenuBtn.addEventListener("click", (e) => {
      const menu = document.getElementById("sbMenu");
      menu.innerHTML = Templates.selectionBarMenu();
      const rect = e.currentTarget.getBoundingClientRect();
      const w = 240, h = 240;
      let x = rect.left;
      let y = rect.top - h - 20;
      if (x + w > window.innerWidth) x = rect.right - w;
      if (y < 0) y = rect.bottom + 8;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.transformOrigin = "bottom left";
      menu.showPopover();
    });

    document.getElementById("sbHint")?.addEventListener("click", () => {
      Actions.clearAllSelections();
    });

    // Sort Headers
    const headers = {
      '.col.name': 'name',
      '.col.req': 'req',
      '.col.creation-odds': 'odds',
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
    document.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      const actionEl = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
      if (actionEl) {
        const action = actionEl.dataset.action;

        if (action === "open-link") {
          const url = actionEl.dataset.url;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        if (action === "copy-appfilter-entry") {
          const id = actionEl.dataset.id;
          if (id) Actions.copyAppFilterEntry(id);
          return;
        }

        if (action === "copy-name-id-entry") {
          const id = actionEl.dataset.id;
          if (id) Actions.copyNamesAndIDs([id]);
          return;
        }

        if (action === "copy-pkg-entry") {
            const id = actionEl.dataset.id;
            if (id) Actions.copyPkgName(id);
            return;
        }

        if (action === "sb-download-metadata") {
          App.state.actionMode = "link";
          Actions.downloadBundle();
          Actions.closeSbMenu();
          return;
        }

        if (action === "sb-copy-appfilter") {
          Actions.copyAppFilter();
          Actions.closeSbMenu();
          return;
        }

        if (action === "sb-copy-nameid") {
          Actions.copyNamesAndIDs();
          Actions.closeSbMenu();
          return;
        }

        if (action === "sb-copy-pkgs") {
            Actions.copySelectedPkgs();
            return;
        }

        if (action === "sb-copy-pr-new") {
          Actions.copyPRDescription("new");
          Actions.closeSbMenu();
          return;
        }

        if (action === "sb-copy-pr-link") {
          Actions.copyPRDescription("link");
          Actions.closeSbMenu();
          return;
        }

        if (action === "sort-option") {
          const value = actionEl.dataset.value;
          if (!value) return;
          App.state.sort = value;
          App.dom.sortLabel.textContent = actionEl.textContent?.trim() || value;
          App.dom.sortMenu.hidePopover();
          this.render();
          return;
        }

        if (action === "view-option") {
          const value = actionEl.dataset.value;
          if (value !== "list" && value !== "grid") return;
          App.state.view = value;
          App.dom.viewLabel.textContent = actionEl.textContent?.trim() || value;
          App.dom.viewMenu.hidePopover();
          this.render();
          return;
        }

        if (action === "filter-tag-toggle") {
          const id = actionEl.dataset.filterId;
          if (!id) return;
          const s = App.state.activeFilters;
          Utils.mutualExclusiveTags(id, s);
          this.render();
          return;
        }

        if (action === "mobile-filter-toggle") {
          const id = actionEl.dataset.filterId;
          if (!id) return;
          const s = App.state.activeFilters;
          Utils.mutualExclusiveTags(id, s);
          this.render();
          this.showMobileFilterPopover();
          return;
        }

        if (action === "geo-batch-apply") {
            return;
        }

        if (action === "regex-suggestion") {
          const value = actionEl.dataset.value;
          if (!value) return;
          App.dom.inputSearch.value = value;
          App.dom.inputSearch.focus();
          App.dom.inputSearch.dispatchEvent(new Event("input"));
          this.hideRegexAutocomplete();
          return;
        }

        if (action === "sort-header-toggle") {
          const key = actionEl.dataset.sortKey;
          if (key) Actions.toggleSortHeader(key);
          return;
        }

        if (action === "domain-filter") {
          const domain = actionEl.dataset.domain;
          if (!domain) return;

          if (App.state.geoBatchConfig !== null) {
            App.state.geoBatchConfig = null;
            App.dom.geoBatchBtn.classList.remove("active");
            Utils.setHidden(App.dom.geoBatchBtn, false);
          }

          App.state.regexMode = true;
          App.dom.regexBtn.classList.add("active");
          Utils.setHidden(App.dom.regexBtn, false);
          Utils.setHidden(App.dom.geoBatchBtn, true);
          App.state.search = `^${domain}\\.`;
          App.dom.inputSearch.value = App.state.search;
          Utils.setHidden(App.dom.clearBtn, false);
          UI.render();
          return;
        }
      }

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

      if (this.regexListEl && !this.regexListEl.contains(target) && target !== App.dom.inputSearch) {
        this.hideRegexAutocomplete();
      }

      const item = /** @type {HTMLElement} */ (target.closest('[data-id]'));
      if (item) {
        Actions.toggleSelection(item.dataset.id, /** @type {MouseEvent} */(e));
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
        if (App.state.selected.size > 0) Actions.clearAllSelections();
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
          const containerWidth = container.clientWidth || document.querySelector(".page").clientWidth - 32;
          const fits = Math.min(entries.length, Math.floor(containerWidth / 80));
          const top = entries.slice(0, fits);

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
    const menus = ['rowMenu', 'mobileFilterMenu', 'geoBatchMenu', 'sortMenu'];
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
        const index = items.indexOf(/** @type {HTMLElement} */(document.activeElement));

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

  },

  initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const more = this.loadMore();
        App.dom.sentinel.style.opacity = more ? "1" : "0";
      }
    }, { rootMargin: "400px" });
    this.observer.observe(App.dom.sentinel);
  },

  render() {
    const s = App.state;
    App.dom.container.innerHTML = "";
    App.dom.container.className = s.view === "grid" ? "grid-container" : "";

    this.syncFilterTagState();

    Data.process();
    Data.syncUrlState();
    this.updateHeader();

    const desc = document.getElementById("supportedDesc");
    const link = document.getElementById("supportedLink");
    Utils.setHidden(desc, false);
    Utils.setHidden(link, false);

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

  showSortMenu() {
    const menu = App.dom.sortMenu;
    const options = UI.sortOptions.filter(opt => {
        if (opt.value === "trending" && Object.keys(App.state.trendingDeltas).length === 0) return false;
        return true;
    });

    menu.innerHTML = Templates.sortMenuItems(options, App.state.sort);

    menu.querySelectorAll(".ctx-item").forEach(item => {
      item.onclick = () => {
        App.state.sort = item.dataset.value;
        App.dom.sortLabel.textContent = item.textContent.trim();
        menu.hidePopover();
        this.render();
      };
    });

    const rect = App.dom.sortBtn.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = (rect.bottom + 8) + "px";
    menu.showPopover();
  },

  showViewMenu() {
    const menu = App.dom.viewMenu;
    const options = [
      { value: "list", label: "List" },
      { value: "grid", label: "Grid" }
    ];

    menu.innerHTML = Templates.viewMenuItems(options, App.state.view);

    menu.querySelectorAll(".ctx-item").forEach(item => {
      item.onclick = () => {
        App.state.view = item.dataset.value;
        App.dom.viewLabel.textContent = item.textContent.trim();
        menu.hidePopover();
        this.render();
      };
    });

    const rect = App.dom.viewBtn.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = (rect.bottom + 8) + "px";
    menu.showPopover();
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
      btn.dataset.action = "filter-tag-toggle";
      btn.dataset.filterId = id;
      btn.setAttribute("aria-pressed", String(App.state.activeFilters.has(id)));
      if (App.state.activeFilters.has(id)) btn.classList.add("active");
      c.appendChild(btn);
    });
  },

  syncFilterTagState() {
    const c = App.dom.filterBox;
    if (!c) return;

    const active = App.state.activeFilters;
    c.querySelectorAll("[data-filter-id]").forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const id = el.dataset.filterId;
      if (!id) return;
      const isActive = active.has(id);
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-pressed", String(isActive));
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

    // Text
    const countEl = App.dom.headerCount;
    let displayText = `${Utils.compactNumber(total)} requests`;
    if (App.state.lastUpdate) {
        displayText += ` • ${Utils.timeAgo(App.state.lastUpdate)}`;
    }
    countEl.textContent = displayText;
    countEl.title = `Last update`;

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

  showGeoBatchConfig() {
    const menu = document.getElementById("geoBatchMenu");
    if (!menu) return;

    const saved = App.state.geoBatchConfig;
    const domainsText = saved ? saved.domainsRaw : "";
    const targetText = saved && saved.target ? saved.target : "";

    menu.innerHTML = Templates.geoBatchConfig(domainsText, targetText);

    const updateTargetState = () => {
      const domainsInput = document.getElementById("geoBatchDomains");
      const targetInput = document.getElementById("geoBatchTarget");
      const applyBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("geoBatchApply"));
      if (!domainsInput || !targetInput || !applyBtn) return;
      const domainsVal = domainsInput.value.trim();
      if (!domainsVal) {
        targetInput.value = "";
        targetInput.disabled = true;
        targetInput.placeholder = "All domains need weights";
        applyBtn.disabled = false; // allow clearing via Apply
        return;
      }
      const items = domainsVal.split(",").map(item => item.trim()).filter(item => item);
      const allHaveWeights = items.length > 0 && items.every(item => item.split(/\s+/).length > 1);
      if (!allHaveWeights) {
        targetInput.value = "";
        targetInput.disabled = true;
        targetInput.placeholder = "All domains need weights";
        applyBtn.disabled = true;
      } else {
        targetInput.disabled = false;
        targetInput.placeholder = "Target icons";
        applyBtn.disabled = false;
      }
    };

    setTimeout(() => {
      const domainsInput = document.getElementById("geoBatchDomains");
      const targetInput = document.getElementById("geoBatchTarget");

      domainsInput.addEventListener("input", () => {
        const domainsRaw = domainsInput.value.trim();
        const targetVal = targetInput.value.trim();
        if (!domainsRaw) {
          App.state.geoBatchConfig = null;
          App.dom.geoBatchBtn.classList.remove("active");
        } else {
          App.state.geoBatchConfig = {
            domainsRaw: domainsRaw,
            target: targetVal || null
          };
        }
        updateTargetState();
      });

      domainsInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });

      targetInput.addEventListener("input", () => {
          targetInput.value = targetInput.value.replace(/[^0-9]/g, "");
          if (App.state.geoBatchConfig) {
              App.state.geoBatchConfig.target = targetInput.value.trim() || null;
          }
      });

      targetInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });

      updateTargetState();

      document.getElementById("geoBatchApply").onclick = () => {
        const domainsRaw = domainsInput.value.trim();
        const targetVal = targetInput.value.trim();

        if (!domainsRaw) {
          App.state.geoBatchConfig = null;
          App.dom.geoBatchBtn.classList.remove("active");
        } else {
          App.state.geoBatchConfig = {
            domainsRaw: domainsRaw,
            target: targetVal || null
          };
          App.dom.geoBatchBtn.classList.add("active");
          App.dom.regexBtn.style.display = "none";
          App.state.regexMode = false;
          App.dom.regexBtn.classList.remove("active");
        }

        UI.render();
        menu.hidePopover();
      };
    }, 0);

    const btnRect = App.dom.geoBatchBtn.getBoundingClientRect();
    menu.style.visibility = "hidden";
    menu.showPopover();
    menu.style.left = (btnRect.right - menu.offsetWidth) + "px";
    menu.style.top = (btnRect.bottom + 8) + "px";
    menu.style.visibility = "visible";
  },

  applyGeoBatch(data) {
    const config = App.state.geoBatchConfig;
    const items = config.domainsRaw.split(",").map(item => item.trim().split(/\s+/));

    const weights = {};
    let totalWeight = 0;
    for (const parts of items) {
      const domain = parts[0];
      const w = parseInt(parts[1]);
      weights[domain] = w;
      totalWeight += w;
    }

    const target = config.target ? parseInt(config.target) : null;
    const limits = {};

    if (target) {
      let planned = 0;
      const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
      for (const [domain, w] of sorted) {
        const count = Math.trunc(target * w / totalWeight);
        limits[domain] = count;
        planned += count;
      }
      limits._remaining = target - planned;
    } else {
      for (const domain of Object.keys(weights)) {
        limits[domain] = Infinity;
      }
      limits._remaining = 0;
    }

    const planDomains = new Set(Object.keys(weights));
    const selected = [];
    const used = new Set();
    const quotas = { ...limits };

    for (const app of data) {
      const domain = app.componentName.split("/")[0].split(".")[0];

      if (planDomains.has(domain)) {
        if (quotas[domain] > 0) {
          selected.push(app);
          used.add(app.componentName);
          quotas[domain]--;
        }
      }
    }

    let unfilled = 0;
    for (const [domain, qty] of Object.entries(quotas)) {
      if (domain !== "_remaining") {
        unfilled += qty;
      }
    }
    limits._remaining += unfilled;

    if (limits._remaining > 0) {
        const usedRemainingDomains = new Set();
        
        for (const app of data) {
            const domain = app.componentName.split("/")[0].split(".")[0];
            
            if (used.has(app.componentName)) continue;
            if (planDomains.has(domain)) continue;
            if (usedRemainingDomains.has(domain)) continue;
            
            selected.push(app);
            used.add(app.componentName);
            usedRemainingDomains.add(domain);
            limits._remaining--;
            
            if (limits._remaining === 0) break;
        }
        
        if (limits._remaining > 0) {
            for (const app of data) {
                const domain = app.componentName.split("/")[0].split(".")[0];
                
                if (used.has(app.componentName)) continue;
                if (planDomains.has(domain)) continue;
                
                selected.push(app);
                used.add(app.componentName);
                limits._remaining--;
                
                if (limits._remaining === 0) break;
            }
        }
    }

    return selected;
  },

  renderDomainStats() {
    const data = App.state.domainStats;
    const card = document.getElementById("domainStatsCard");
    if (!card) return;

    if (!data || Object.keys(data).length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";

    const container = document.getElementById("domainStats");
    if (!container) return;

    const containerWidth = container.clientWidth || document.querySelector(".page").clientWidth - 64;
    const colWidth = 26;
    const fits = Math.floor(containerWidth / colWidth);

    const nonGeo = new Set(["ai", "me", "my", "tv", "fm", "to", "st", "cc", "ws", "nu", "tk", "sh", "is", "as", "je", "gg", "im", "io", "co"]);
    const isCountryCode = (domain) => /^[a-z]{2}$/.test(domain) && !nonGeo.has(domain);
    const mode = App.state.domainStatsMode;
    
    // Calc avg installs per domain (once)
    if (!App.state._domainAvgInstalls) {
        App.state._domainAvgInstalls = {};
        const domainCountsI = {};
        const domainSumsI = {};
        App.data.forEach(app => {
            const pkg = app.componentName.split('/')[0];
            const domain = pkg.split('.')[0];
            if (isCountryCode(domain)) {
                const instStr = app.installs ? app.installs.replace(/[,+]/g, '') : '0';
                const inst = parseInt(instStr, 10) || 0;
                domainSumsI[domain] = (domainSumsI[domain] || 0) + inst;
                domainCountsI[domain] = (domainCountsI[domain] || 0) + 1;
            }
        });
        for (const d of Object.keys(domainSumsI)) {
            App.state._domainAvgInstalls[d] = Math.round(domainSumsI[d] / domainCountsI[d]);
        }
    }

    const population = (data._population) || {};
    
    let entries = Object.entries(data)
        .filter(([domain]) => isCountryCode(domain) && domain !== "_population")
        .map(([domain, stats]) => [domain, stats.done, stats.requests, stats.total]);

    if (mode === "local") {
    entries = entries
        .filter(([, , requests]) => requests > 15)
        .sort((a, b) => {
            const instA = App.state._domainAvgInstalls[a[0]] || 0;
            const instB = App.state._domainAvgInstalls[b[0]] || 0;
            const scoreA = (a[3] - a[1]) * instA;
            const scoreB = (b[3] - b[1]) * instB;
            return scoreB - scoreA;
        });
    } else if (mode === "coverage") {
        entries = entries
            .filter(([, , requests]) => requests >= 15)
            .sort((a, b) => {
                const pctA = a[2] / a[3];
                const pctB = b[2] / b[3];
                return pctB - pctA;
            });
    } else {
        entries = entries
            .filter(([, , requests]) => requests >= 15)
            .sort((a, b) => b[3] - a[3]);
    }
    
    const max = Math.max(...entries.map(e => e[3]), 1);

    const title = document.querySelector("#domainStatsCard .card-title");
    if (title) {
        if (mode === "local") title.textContent = "Local impact";
        else if (mode === "coverage") title.textContent = "Lowest coverage";
        else title.textContent = "Top domains";
    }

    const sub = document.querySelector("#domainStatsCard .card-sub");
    if (sub) sub.style.display = "none";

    container.innerHTML = Templates.domainStatsCard(entries, max);

    const tooltip = container.querySelector(".chart-tooltip");
    if (!tooltip) return;

    container.addEventListener("mousemove", (e) => {
      const col = e.target.closest(".domain-col");
      if (!col) {
        tooltip.style.display = "none";
        return;
      }
      const domain = col.dataset.domain;
      const done = parseInt(col.dataset.done);
      const requests = parseInt(col.dataset.requests);
      const total = parseInt(col.dataset.total);
      const avgInst = App.state._domainAvgInstalls[domain] || 0;
      const pop = population[domain] || 0;
      tooltip.innerHTML = Templates.domainStatsTooltip(domain, done, requests, total, mode, avgInst, pop);
      tooltip.style.display = "block";
      const rect = col.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      tooltip.style.top = "0px";
      tooltip.style.transform = "translateY(-50%)";
      tooltip.style.left = (rect.left - containerRect.left + rect.width) + "px";
    });

    container.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  },

  renderActivityCard() {
    const history = App.state.activityStats;
    const card = document.getElementById("activityCard");

    const container = document.getElementById("activityChart");
    if (!container) return;

    if (!history || history.length < 2) {
      container.innerHTML = Templates.activityCardEmpty();
      return;
    }

    const last14 = history.slice(-14);
    const totalNew = last14.reduce((sum, d) => sum + (d.added || 0), 0);
    const totalRemoved = last14.reduce((sum, d) => sum + (d.fulfilled || 0) + (d.outdated || 0) + (d.manual_removed || 0), 0);

    const maxNew = Math.max(...last14.map(d => d.added || 0));
    const maxRemoved = Math.max(...last14.map(d => (d.fulfilled || 0) + (d.outdated || 0) + (d.manual_removed || 0)));
    const maxVal = Math.max(maxNew, maxRemoved);
    if (maxVal === 0) return;

    const newPoints = last14.map((d, i) => ({
      x: (i / (last14.length - 1) * 100),
      y: (50 - (d.added || 0) / maxVal * 50)
    }));

    const removedPoints = last14.map((d, i) => ({
      x: (i / (last14.length - 1) * 100),
      y: (50 + ((d.fulfilled || 0) + (d.outdated || 0) + (d.manual_removed || 0)) / maxVal * 50)
    }));

    const makePath = (points) => {
      if (points.length < 2) return "";
      let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 1; i < points.length; i++) {
        const cp1x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp1y = points[i - 1].y.toFixed(1);
        const cp2x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp2y = points[i].y.toFixed(1);
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
      }
      return d;
    };

    const pathNew = makePath(newPoints);
    const pathRemoved = makePath(removedPoints);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const firstDate = new Date(last14[0].date + "T12:00:00");
    const lastDate = new Date(last14[last14.length - 1].date + "T12:00:00");
    const firstLabel = `${monthNames[firstDate.getMonth()]} ${firstDate.getDate()}`;
    const lastLabel = `${monthNames[lastDate.getMonth()]} ${lastDate.getDate()}`;
    const mid1Date = new Date(last14[Math.floor(last14.length / 3)].date + "T12:00:00");
    const mid1Label = `${monthNames[mid1Date.getMonth()]} ${mid1Date.getDate()}`;
    const mid2Date = new Date(last14[Math.floor(last14.length * 2 / 3)].date + "T12:00:00");
    const mid2Label = `${monthNames[mid2Date.getMonth()]} ${mid2Date.getDate()}`;

    const dayLabels = last14.map((d, i) => {
      if (i === 0) return `<span class="chart-label">${firstLabel}</span>`;
      if (i === Math.floor(last14.length / 2)) return `<span class="chart-label" id="activityPace"></span>`;
      if (i === last14.length - 1) return `<span class="chart-label">${lastLabel}</span>`;
      return `<span class="chart-label"></span>`;
    }).join("");

    container.innerHTML = Templates.activityCard(pathNew, pathRemoved, dayLabels);

    const subEl = document.getElementById("activitySub");
    if (subEl) subEl.textContent = `${Utils.compactNumber(totalNew)} new • ${Utils.compactNumber(totalRemoved)} resolved`;

    const paceEl = document.getElementById("activityPace");
    if (paceEl && App.state.medianTTF !== undefined) {
        paceEl.textContent = `${App.state.medianTTF}d from ask to icon`;
        paceEl.title = "Median time from request to icon over the last 365 days.";
    }

    const svg = container.querySelector(".activity-svg");
    if (!svg) return;

    const tooltip = /** @type {HTMLElement | null} */ (container.querySelector(".chart-tooltip"));
    if (!tooltip) return;

    const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    vLine.classList.add("activity-vline");
    vLine.style.display = "none";
    svg.appendChild(vLine);

    svg.addEventListener("mousemove", (e) => {
      const svgRect = svg.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const x = (e.clientX - svgRect.left) / svgRect.width * 100;
      const idx = Math.round(x / 100 * (last14.length - 1));
      const clamped = Math.min(last14.length - 1, Math.max(0, idx));
      const snapX = (clamped / (last14.length - 1) * 100);

      vLine.setAttribute("x1", snapX);
      vLine.setAttribute("x2", snapX);
      vLine.setAttribute("y1", "0");
      vLine.setAttribute("y2", "100");
      vLine.style.display = "";

      const added = last14[clamped].added || 0;
      const removed = (last14[clamped].fulfilled || 0) + (last14[clamped].outdated || 0) + (last14[clamped].manual_removed || 0);

      const dateParts = last14[clamped].date.split("-");
      const formattedDate = `${monthNames[parseInt(dateParts[1]) - 1]} ${parseInt(dateParts[2])}`;
      tooltip.innerHTML = Templates.activityTooltip(formattedDate, added, removed);
      tooltip.style.display = "block";

      const left = snapX / 100 * svgRect.width + 12;
      tooltip.style.left = left + "px";
      tooltip.style.top = "0px";
      tooltip.style.transform = "translateY(-50%)";
    });

    svg.addEventListener("mouseleave", () => {
      vLine.style.display = "none";
      tooltip.style.display = "none";
    });

  },

  initRegexAutocomplete() {
    const input = App.dom.inputSearch;
    const wrapper = document.getElementById("search-wrapper");
    if (!wrapper) return;

    input.addEventListener("input", () => {
      this.hideRegexAutocomplete();
      if (!App.state.regexMode) return;

      const val = input.value;
      if (!val || val.includes(".")) return;

      const domains = Object.keys(App.state.domainStats);
      if (!domains.length) return;

      const matches = domains
        .filter(d => d.toLowerCase().startsWith(val.toLowerCase()))
        .slice(0, 5);
      if (!matches.length) return;

      const listEl = document.createElement("div");
      listEl.className = "autocomplete-list";
      listEl.setAttribute("role", "listbox");
      listEl.innerHTML = Templates.regexAutocompleteList(matches);
      listEl.style.top = `${input.offsetTop + input.offsetHeight + 4}px`;
      listEl.style.left = `${input.offsetLeft}px`;
      listEl.style.width = `${input.offsetWidth}px`;

      wrapper.appendChild(listEl);
      this.regexListEl = listEl;
    });
  },

  hideRegexAutocomplete() {
    if (!this.regexListEl) return;
    this.regexListEl.remove();
    this.regexListEl = null;
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
  },

  showMobileFilterPopover() {
      const menu = App.dom.mobileFilterMenu;
      menu.innerHTML = "";
      const s = App.state.activeFilters;
      menu.innerHTML = CONFIG.data.filters.map(id => {
        const meta = App.state.filterMetadata.get(id);
        if (!meta) return "";
        return Templates.mobileFilterItem(id, meta.label, s.has(id));
      }).join("");

      const rect = App.dom.mobileFilterBtn.getBoundingClientRect();
      menu.style.visibility = "hidden";
      menu.showPopover();
      menu.style.left = `${rect.right - menu.offsetWidth}px`;
      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.visibility = "visible";
  },

  buildQuickPickQueue() {
      const NON_GEO = new Set(["ai", "me", "my", "tv", "fm", "to", "st", "cc", "ws", "nu", "tk", "sh", "is", "as", "je", "gg", "im", "io", "co"]);
      const POP = App.state.domainStats._population || {};
      const isCountry = (d) => d.length === 2 && !NON_GEO.has(d) && d in POP;
      
      // Calc local_impact per country
      const domainInstalls = {};
      const domainInstCounts = {};
      App.data.forEach(app => {
          const pkg = app.componentName.split('/')[0];
          const domain = pkg.split('.')[0];
          if (!isCountry(domain)) return;
          const inst = Utils.parseInstalls(app.installs);
          domainInstalls[domain] = (domainInstalls[domain] || 0) + inst;
          domainInstCounts[domain] = (domainInstCounts[domain] || 0) + 1;
      });
      
      const localImpact = {};
      for (const d of Object.keys(domainInstalls)) {
          const s = App.state.domainStats[d] || {};
          const unf = s.requests || 0;
          const avg = Math.round(domainInstalls[d] / domainInstCounts[d]);
          localImpact[d] = unf * avg;
      }
      
      const liValues = Object.values(localImpact).sort((a,b) => a-b);
      const n = liValues.length;
      const q1 = liValues[Math.floor(n/4)] || 0;
      const q2 = liValues[Math.floor(n/2)] || 0;
      const q3 = liValues[Math.floor(3*n/4)] || 0;
      
      const quartileUrgency = (li) => {
          if (li >= q3) return 1.0;
          if (li >= q2) return 0.75;
          if (li >= q1) return 0.5;
          return 0.25;
      };
      
      const now = Date.now() / 1000;
      
      App.state._quickPickMiddle = [];
      App.state._quickPickEasy = [];
      
      App.data.forEach(app => {
          const tags = App.state.appTags.get(app.componentName) || new Set();
          
          const isEasy = tags.has('easy');
          const isMatch = tags.has('match');
          const isNameInUse = tags.has('nameinuse');
          
          const pkg = app.componentName.split('/')[0];
          const domain = pkg.split('.')[0];
          const req = app.requestCount || 0;
          const inst = Utils.parseInstalls(app.installs);
          const first = app.firstAppearance || 0;
          const last = app.lastRequested || 0;
          const daysActive = (last - first) / 86400;
          const freshness = Math.min(1, daysActive / 365);
          
          let urg = 0.5;
          if (isCountry(domain)) {
              const li = localImpact[domain] || 0;
              urg = quartileUrgency(li);
          }
          const urgencyMod = 0.5 + 0.5 * urg;
          const score = Math.log(inst + 1) * Math.sqrt(req) * freshness * urgencyMod;
          
          const item = { ...app, _score: score };

          // Easy: only easy, excl. match and nameinuse
          if (isEasy && !isMatch && !isNameInUse) {
              App.state._quickPickEasy.push(item);
          }          
          
          // Middle+: excl. easy, match and nameinuse
          if (!isEasy && !isMatch && !isNameInUse) {
              App.state._quickPickMiddle.push(item);
          }
          
      });
      
      App.state._quickPickMiddle.sort((a,b) => b._score - a._score);
      App.state._quickPickEasy.sort((a,b) => b._score - a._score);
      App.state._quickPickMiddle = App.state._quickPickMiddle.slice(0, 1000);
      App.state._quickPickEasy = App.state._quickPickEasy.slice(0, 1000);
      
      App.state.quickPickMode = App.state.quickPickMode || 'easy';
  },

  renderQuickPick() {
      if (!App.state._quickPickMiddle || !App.state._quickPickMiddle.length) {
          this.buildQuickPickQueue();
      }
      this.pickRandomQuickPick();
  },

  pickRandomQuickPick() {
      const queue = App.state.quickPickMode === 'easy' 
              ? App.state._quickPickEasy 
              : App.state._quickPickMiddle;
      if (!queue || !queue.length) return;
      
      const idx = Math.floor(Math.random() * queue.length);
      App.state._lastQuickPickIdx = idx;
      const app = queue[idx];
      const card = document.getElementById("quickPickCard");
      
      card.style.backgroundImage = `url('extracted_png/${app.drawable}.png')`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
      card.style.backgroundRepeat = 'no-repeat';
      card.title = app.label;
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
    try { /** @type {any} */ (App.dom.sortMenu).hidePopover(); } catch { }
    try { /** @type {any} */ (App.dom.rowMenu).hidePopover(); } catch { }
    try { /** @type {any} */ (App.dom.mobileFilterMenu).hidePopover(); } catch { }
    try { /** @type {any} */ (App.dom.geoBatchMenu).hidePopover(); } catch { }

    setTimeout(() => {
      App.dom.rowMenu.innerHTML = "";
      App.dom.mobileFilterMenu.innerHTML = "";
    }, 200);
  },
};


// Start
Data.init();
