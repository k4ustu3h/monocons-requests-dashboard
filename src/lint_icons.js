// scripts/lint_icons.js — SVG linter for browser, 1:1 port of Monocons Python lint_icons.py
// Active rules: C01, C05, C07, C10, O01

/**
 * Parse CSS style attribute into key-value map
 * @param {string|null} styleStr
 * @returns {Object<string,string>}
 */
function parseStyleAttribute(styleStr) {
  if (!styleStr) return {};
  const result = {};
  const pairs = styleStr.toLowerCase().matchAll(/([\w-]+)\s*:\s*([^;]+)/g);
  for (const [, key, val] of pairs) {
    result[key] = val.trim();
  }
  return result;
}

/**
 * Lint SVG content, return array of issue strings (empty = pass)
 * @param {string} content
 * @returns {string[]}
 */
function lintSVG(content) {
  const issues = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const root = doc.documentElement;

    if (!root || root.tagName.toLowerCase() !== 'svg') {
      return ['XML missing or not a valid SVG'];
    }

    const allElements = Array.from(root.querySelectorAll('*'));

    // ---------------------------------------------------------
    // C01: Canvas size (Monocons expects 192x192)
    // ---------------------------------------------------------
    const vbStr = (root.getAttribute('viewBox') || '').trim();
    const vb = vbStr ? vbStr.split(/\s+/) : [];
    const w = (root.getAttribute('width') || '').replace('px', '').trim();
    const h = (root.getAttribute('height') || '').replace('px', '').trim();

    const hasCorrectViewBox = vb.length === 4 &&
      vb[0] === '0' &&
      vb[1] === '0' &&
      vb[2] === '192' &&
      vb[3] === '192';
    const hasCorrectSize = w === '192' && h === '192';

    if (!hasCorrectViewBox && !hasCorrectSize) {
      const vbFmt = vb.length > 0 ? `['${vb.join("', '")}']` : '[]';
      issues.push(`Invalid canvas: viewBox=${vbFmt}, w=${w}, h=${h}`);
    }

    // ---------------------------------------------------------
    // C05: Transparency (Monocons allows 1 / 1.0, flags others for REVIEW)
    // ---------------------------------------------------------
    const forbiddenAttrs = [
      'opacity',
      'fill-opacity',
      'stroke-opacity',
      'stop-opacity',
    ];

    allElements.forEach((el) => {
      const tag = el.tagName.toLowerCase();

      // Check direct attributes
      for (const attr of forbiddenAttrs) {
        const val = el.getAttribute(attr);
        if (!val) continue;

        const normalized = val.trim().toLowerCase();
        if (
          attr.includes('opacity') &&
          (normalized === '1' || normalized === '1.0')
        ) {
          continue;
        }

        issues.push(
          `Transparency '${attr}' in <${tag}>. Ensure transparency is necessary to match the original icon.`,
        );
      }

      // Check inline styles
      const styleVal = el.getAttribute('style');
      if (styleVal) {
        const styleMap = parseStyleAttribute(styleVal);
        for (const prop of forbiddenAttrs) {
          if (styleMap[prop] !== undefined) {
            const normalized = styleMap[prop].trim().toLowerCase();
            if (
              prop.includes('opacity') &&
              (normalized === '1' || normalized === '1.0')
            ) {
              continue;
            }
            issues.push(
              `Transparency '${prop}' in style on <${tag}>. Avoid unnecessary transparency.`,
            );
          }
        }
      }
    });

    // ---------------------------------------------------------
    // C07: Monochrome colors
    // ---------------------------------------------------------
    const allowedColors = new Set(['none', '#000000', '#000', 'black']);

    const rootStyle = parseStyleAttribute(root.getAttribute('style'));
    const rootFill = (
      rootStyle['fill'] ||
      root.getAttribute('fill') ||
      'black'
    ).toLowerCase();

    const stack = [{ el: root, inheritedFill: rootFill }];

    while (stack.length > 0) {
      const { el, inheritedFill } = stack.pop();
      const tag = el.tagName.toLowerCase(); // DOMParser usually preserves case, but HTML DOM doesn't. Safe to lower.

      const localStyle = parseStyleAttribute(el.getAttribute('style'));

      const localFillAttr = localStyle['fill'] || el.getAttribute('fill');
      const currentFill = localFillAttr
        ? localFillAttr.trim().toLowerCase()
        : inheritedFill;

      const localStrokeAttr = localStyle['stroke'] || el.getAttribute('stroke');
      const localStroke = localStrokeAttr
        ? localStrokeAttr.trim().toLowerCase()
        : null;

      const containerTags = [
        'defs',
        'style',
        'clippath',
        'lineargradient',
        'radialgradient',
        'g',
        'svg',
      ];

      if (containerTags.includes(tag)) {
        for (const child of el.children) {
          stack.push({ el: child, inheritedFill: currentFill });
        }
        continue;
      }

      const shapeTags = [
        'path',
        'circle',
        'rect',
        'ellipse',
        'line',
        'polygon',
        'polyline',
      ];

      if (shapeTags.includes(tag)) {
        if (
          !allowedColors.has(currentFill) &&
          !currentFill.startsWith('url(')
        ) {
          issues.push(
            `<${tag}> has unauthorized fill '${currentFill}'. Monocons must be monochrome (black, none, or gradients).`,
          );
        }
        if (localStroke) {
          if (
            !allowedColors.has(localStroke) &&
            !localStroke.startsWith('url(')
          ) {
            issues.push(
              `<${tag}> has unauthorized stroke '${localStroke}'. Must be monochrome (black, none, or gradients).`,
            );
          }
        }
      }

      for (const child of el.children) {
        stack.push({ el: child, inheritedFill: currentFill });
      }
    }

    // ---------------------------------------------------------
    // C10: Rounded corners (rx must be 6-32)
    // ---------------------------------------------------------
    allElements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'rect') {
        const rx = el.getAttribute('rx');

        if (rx === null) {
          issues.push('Rect lacks rx attribute.');
          return;
        }

        const rxVal = parseFloat(rx);
        if (isNaN(rxVal)) {
          issues.push(`Rect has invalid rx: ${rx}`);
        } else if (rxVal < 6 || rxVal > 32) {
          issues.push(`Rect rx='${rx}' out of 6-32 range.`);
        }
      }
    });

    // ---------------------------------------------------------
    // O01: SVG size
    // ---------------------------------------------------------
    const sizeKb = new Blob([content]).size / 1024;
    if (sizeKb > 3) {
      issues.push('SVG file size exceeds 3KB. Avoid excessive density.');
    }
  } catch (e) {
    issues.push(`Error parsing SVG: ${e.message}`);
  }

  return issues;
}
