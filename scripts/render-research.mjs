import { marked } from 'marked';

export function renderResearch(markdown, sourceIds, { citationPrefix = '#ref-', resolveLink } = {}) {
  const headings = [];
  const cited = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const id = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (depth === 2) headings.push({ id, text });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.table = function (token) {
    return `<div class="table-wrap" tabindex="0" role="region" aria-label="Research comparison table">${marked.Renderer.prototype.table.call(this, token)}</div>`;
  };
  if (resolveLink) {
    renderer.link = function (token) {
      return marked.Renderer.prototype.link.call(this, { ...token, href: resolveLink(token.href) });
    };
  }
  const linked = markdown.replace(/\[(S\d{2})\]/g, (_, id) => {
    if (!sourceIds.has(id)) throw new Error(`Unknown citation: ${id}`);
    cited.add(id);
    return `<sup><a href="${citationPrefix}${id}" aria-label="Source ${id}">[${id}]</a></sup>`;
  });
  return { html: marked.parse(linked, { renderer }), headings, cited };
}
