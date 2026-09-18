import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { marked } from 'marked';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const sources = JSON.parse(await read('research/sources.json')).sort((a, b) => a.id.localeCompare(b.id));
const report = await read('research/report.md');
const template = await read('site/template.html');
const ids = new Set();
for (const source of sources) {
  if (!/^S\d{2}$/.test(source.id) || ids.has(source.id)) throw new Error(`Invalid/duplicate source: ${source.id}`);
  if (!['https:'].includes(new URL(source.url).protocol)) throw new Error(`Unsafe source URL: ${source.id}`);
  for (const key of ['title', 'author', 'year', 'claim', 'limit', 'accessed']) {
    if (!source[key]) throw new Error(`Source ${source.id} missing ${key}`);
  }
  ids.add(source.id);
}

const headings = [];
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
const cited = new Set();
const citedReport = report.replace(/\[(S\d{2})\]/g, (_, id) => {
  if (!ids.has(id)) throw new Error(`Unknown citation: ${id}`);
  cited.add(id);
  return `<sup><a href="#ref-${id}" aria-label="Source ${id}">[${id}]</a></sup>`;
});
const rendered = marked.parse(citedReport, { renderer });
for (const id of ids) if (!cited.has(id)) throw new Error(`Uncited source: ${id}`);
const references = sources.map(source =>
  `<li id="ref-${source.id}"><span class="source-id">${source.id} / ${escape(source.year)}</span>
  <p><strong>${escape(source.author)}.</strong> <a href="${escape(source.url)}">${escape(source.title)}</a></p>
  <p>${escape(source.claim)}</p><p class="limit"><strong>Limit:</strong> ${escape(source.limit)}</p></li>`
).join('\n');
const contents = `<ol>${headings.map(({ id, text }) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ol>`;
const html = template.replace('{{REPORT}}', rendered).replace('{{CONTENTS}}', contents)
  .replace('{{REFERENCES}}', references).replace('{{SOURCE_COUNT}}', sources.length);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
for (const file of ['styles.css', 'app.mjs', 'model.mjs', 'divergence.svg', 'divergence.html']) {
  await copyFile(new URL(`site/${file}`, root), new URL(`dist/${file}`, root));
}
const bibliography = sources.map(s => `- **${s.id}.** ${s.author} (${s.year}). [${s.title}](${s.url}). ${s.claim} Limit: ${s.limit}`).join('\n\n');
await writeFile(new URL('dist/report.md', root), `${report}\n\n## References\n\n${bibliography}\n`);
await copyFile(new URL('research/sources.json', root), new URL('dist/sources.json', root));
await copyFile(new URL('examples/knowledge-object.json', root), new URL('dist/knowledge-object.json', root));
await writeFile(new URL('dist/.nojekyll', root), '');
console.log(`Built ${headings.length} sections; validated ${sources.length} cited sources.`);
