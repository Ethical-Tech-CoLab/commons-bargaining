import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPresentationData } from './presentation-data.mjs';
import { renderResearch } from './render-research.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const sources = JSON.parse(await read('research/sources.json')).sort((a, b) => a.id.localeCompare(b.id));
const report = await read('research/report.md');
const template = await read('site/template.html');
const diagramTemplate = await read('site/divergence.html');
const workSource = await read('research/open-work.json');
const work = JSON.parse(workSource);
const header = await read('site/header.html');
const headerCss = await read('site/header.css');
const renderHeader = page => header.replaceAll('{{PREFIX}}', page === 'main' ? '#' : './index.html#')
  .replace('{{OVERVIEW_CURRENT}}', ['main', 'overview'].includes(page) ? 'aria-current="location"' : '')
  .replace('{{DEMOS_CURRENT}}', page === 'diagram' ? 'aria-current="location"' : '')
  .replace('{{RESEARCH_CURRENT}}', page === 'work' ? 'aria-current="location"' : '');
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

const { html: rendered, headings, cited } = renderResearch(report, ids);
for (const id of ids) if (!cited.has(id)) throw new Error(`Uncited source: ${id}`);
const references = sources.map(source =>
  `<li id="ref-${source.id}"><span class="source-id">${source.id} / ${escape(source.year)}</span>
  <p><strong>${escape(source.author)}.</strong> <a href="${escape(source.url)}">${escape(source.title)}</a></p>
  <p>${escape(source.claim)}</p><p class="limit"><strong>Limit:</strong> ${escape(source.limit)}</p></li>`
).join('\n');
const contents = `<ol>${headings.map(({ id, text }) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ol>`;
const html = template.replace('{{REPORT}}', rendered).replace('{{CONTENTS}}', contents)
  .replace('{{HEADER}}', renderHeader('main'))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('{{REFERENCES}}', references).replace('{{SOURCE_COUNT}}', sources.length)
  .replace('href="./styles.css"', `href="./styles.css?v=${fingerprint(stylesheet)}"`)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('src="./app.mjs"', `src="./app.mjs?v=${fingerprint(app)}"`);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/app.mjs', root), app);
const diagram = diagramTemplate.replace('{{HEADER}}', renderHeader('diagram'))
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
await copyFile(new URL('examples/component-passport.json', root), new URL('dist/component-passport.json', root));

const presentation = createPresentationData({
  report, headings, template, diagramTemplate, work, sources,
  revision: {
    contentHash: fingerprint([report, template, diagramTemplate, workSource, JSON.stringify(sources)].join('\0')),
    builtAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
  },
});
await writeFile(new URL('dist/presentation-data.json', root), JSON.stringify(presentation, null, 2));
await writeFile(new URL('dist/open-work.json', root), workSource);

const presentationModel = await read('site/presentation-model.mjs');
const overviewApp = (await read('site/overview.mjs')).replaceAll('./presentation-model.mjs', `./presentation-model.mjs?v=${fingerprint(presentationModel)}`);
const overviewCss = await read('site/overview.css');
const overview = (await read('site/overview.html'))
  .replace('{{HEADER}}', renderHeader('overview'))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./overview.css"', `href="./overview.css?v=${fingerprint(overviewCss)}"`)
  .replace('src="./overview.mjs"', `src="./overview.mjs?v=${fingerprint(overviewApp)}"`);
if (/\{\{[A-Z_]+\}\}/.test(overview)) throw new Error('Unresolved overview template placeholder');
await writeFile(new URL('dist/overview.html', root), overview);
await writeFile(new URL('dist/overview.mjs', root), overviewApp);
await writeFile(new URL('dist/presentation-model.mjs', root), presentationModel);
await writeFile(new URL('dist/overview.css', root), overviewCss);

const sectionById = new Map(presentation.sections.map(section => [section.id, section]));
const workCards = presentation.workItems.map(item => `<article class="work-item" id="${escape(item.id)}">
  <span class="status">${escape(item.status.replaceAll('-', ' '))}</span>
  <h2>${escape(item.title)}</h2><p>${escape(item.question)}</p>
  <p class="next"><strong>Next step:</strong> ${escape(item.nextStep)}</p>
  <ul>${item.sourceIds.map(id => {
    const section = sectionById.get(id);
    return `<li><a href="${escape(section.url)}">${escape(section.title)}</a></li>`;
  }).join('')}</ul></article>`).join('\n');
const counts = ['open', 'in-progress', 'blocked', 'done'].map(status =>
  `${presentation.workItems.filter(item => item.status === status).length} ${status.replaceAll('-', ' ')}`
).join(' / ');
const workCss = await read('site/open-work.css');
const workPage = (await read('site/open-work.html'))
  .replace('{{HEADER}}', renderHeader('work'))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./open-work.css"', `href="./open-work.css?v=${fingerprint(workCss)}"`)
  .replace('{{WORK_DESCRIPTION}}', escape(work.description))
  .replace('{{REVISION}}', `Source revision ${escape(presentation.revision.contentHash)} / built ${escape(presentation.revision.builtAt)}`)
  .replace('{{QUESTIONS_URL}}', escape(sectionById.get(presentation.featured.questions).url))
  .replace('{{WORK_COUNTS}}', escape(counts))
  .replace('{{WORK_ITEMS}}', workCards);
if (/\{\{[A-Z_]+\}\}/.test(workPage)) throw new Error('Unresolved work-register template placeholder');
await writeFile(new URL('dist/open-work.html', root), workPage);
await writeFile(new URL('dist/open-work.css', root), workCss);
await writeFile(new URL('dist/.nojekyll', root), '');
console.log(`Built ${headings.length} sections, ${sources.length} cited sources, and ${presentation.workItems.length} linked work items.`);
