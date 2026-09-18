import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { marked } from 'marked';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const sources = JSON.parse(await read('research/sources.json')).sort((a, b) => a.id.localeCompare(b.id));
const report = await read('research/report.md');
const template = await read('site/template.html');
const header = await read('site/header.html');
const headerCss = await read('site/header.css');
const renderHeader = demo => header.replaceAll('{{PREFIX}}', demo ? './index.html#' : '#')
  .replace('{{OVERVIEW_CURRENT}}', demo ? '' : 'aria-current="location"')
  .replace('{{DEMOS_CURRENT}}', demo ? 'aria-current="location"' : '');
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const faviconUrl = `./favicon.svg?v=${fingerprint(await read('site/favicon.svg'))}`;
const stylesheet = await read('site/styles.css');
const model = await read('site/model.mjs');
const app = (await read('site/app.mjs')).replace("'./model.mjs'", `'./model.mjs?v=${fingerprint(model)}'`);
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
  .replace('{{HEADER}}', renderHeader(false))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('{{REFERENCES}}', references).replace('{{SOURCE_COUNT}}', sources.length)
  .replace('href="./styles.css"', `href="./styles.css?v=${fingerprint(stylesheet)}"`)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('src="./app.mjs"', `src="./app.mjs?v=${fingerprint(app)}"`);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/app.mjs', root), app);
const diagram = (await read('site/divergence.html')).replace('{{HEADER}}', renderHeader(true))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`);
if (/\{\{[A-Z_]+\}\}/.test(diagram)) throw new Error('Unresolved diagram template placeholder');
await writeFile(new URL('dist/divergence.html', root), diagram);
for (const file of ['styles.css', 'header.css', 'model.mjs', 'divergence.svg', 'favicon.svg']) {
  await copyFile(new URL(`site/${file}`, root), new URL(`dist/${file}`, root));
}
const bibliography = sources.map(s => `- **${s.id}.** ${s.author} (${s.year}). [${s.title}](${s.url}). ${s.claim} Limit: ${s.limit}`).join('\n\n');
await writeFile(new URL('dist/report.md', root), `${report}\n\n## References\n\n${bibliography}\n`);
await copyFile(new URL('research/sources.json', root), new URL('dist/sources.json', root));
await copyFile(new URL('examples/knowledge-object.json', root), new URL('dist/knowledge-object.json', root));
await copyFile(new URL('examples/reputation-observation.json', root), new URL('dist/reputation-observation.json', root));
await writeFile(new URL('dist/.nojekyll', root), '');
console.log(`Built ${headings.length} sections; validated ${sources.length} cited sources.`);
