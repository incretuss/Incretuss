// Tiny templating helpers. Values interpolated with esc() are escaped;
// strings that are already trusted markup (from src/content) are passed
// through as-is.
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Join an array of markup fragments, skipping empty values.
export function join(parts, sep = '') {
  return parts.filter(Boolean).join(sep);
}

// Plain-text version of a trusted markup string (for meta descriptions).
export function text(markup) {
  return String(markup)
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

// Contact-form link that arrives with the product (and request type)
// already filled in — read by js/contact.js.
export function inquiryHref(productName, need, form) {
  const params = new URLSearchParams();
  if (productName) params.set('product', productName);
  if (form) params.set('form', form);
  if (need) params.set('need', need);
  const qs = params.toString();
  return 'contact.html' + (qs ? '?' + qs : '');
}

export const icons = {
  arrow:
    '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/></svg>',
  search:
    '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.5"/></svg>',
  chevron:
    '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  plus:
    '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.4"/></svg>',
};
