import "./DomSnippet.css";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Tiny hand-rolled highlighter — no syntax-highlighting dependency for one
 * use case. Safety note: `escapeHtml` runs first, so every literal
 * `<`/`>`/`"` in the captured outerHTML is already an inert entity before
 * any `<span>` wrapping happens below — the regexes only ever match
 * already-escaped delimiters (`&lt;`, `&quot;`), so there's no path for the
 * captured DOM content to inject a live tag into this page.
 */
function highlightHtml(raw: string): string {
  const escaped = escapeHtml(raw);
  let out = escaped.replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, (_m, open: string, name: string) => `${open}<span class="dom-snippet__tag">${name}</span>`);
  out = out.replace(
    /([a-zA-Z-]+)(=)(&quot;[^&]*&quot;)/g,
    (_m, attr: string, eq: string, val: string) => `<span class="dom-snippet__attr">${attr}</span>${eq}<span class="dom-snippet__value">${val}</span>`,
  );
  return out;
}

export function DomSnippet({ html }: { html: string }) {
  return (
    <pre className="dom-snippet">
      <code dangerouslySetInnerHTML={{ __html: highlightHtml(html) }} />
    </pre>
  );
}
