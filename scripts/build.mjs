import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCompanionSection, createPresentationData } from './presentation-data.mjs';
import { renderResearch } from './render-research.mjs';
import QRCode from 'qrcode';
import { validateUsageAudit, renderUsageAudit, usageAuditSection } from './usage-audit.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const sources = [
  ...JSON.parse(await read('research/sources.json')),
  ...JSON.parse(await read('research/replication-sources.json')),
].sort((a, b) => a.id.localeCompare(b.id));
const report = await read('research/report.md');
const replicationPaper = await read('research/replication-blueprint.md');
const sectorProfile = JSON.parse(await read('templates/sector-profile.json'));
const template = await read('site/template.html');
const diagramTemplate = await read('site/divergence.html');
const workSource = await read('research/open-work.json');
const work = JSON.parse(workSource);
const usageSource = await read('usage/ai-usage.json');
const usageConfig = JSON.parse(await read('usage/audit-config.json'));
const usageProvenance = JSON.parse(await read('vendor/usage-calc/UPSTREAM.json'));
const captureAdapterSha256 = createHash('sha256')
  .update((await read('scripts/capture-ai-usage.py')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')).digest('hex');
const usageAudit = validateUsageAudit(JSON.parse(usageSource), usageConfig, usageProvenance, captureAdapterSha256);
const header = await read('site/header.html');
const headerCss = await read('site/header.css');
const renderHeader = page => header.replaceAll('{{PREFIX}}', page === 'main' ? '#' : './index.html#')
  .replace('{{OVERVIEW_CURRENT}}', ['main', 'overview'].includes(page) ? 'aria-current="location"' : '')
  .replace('{{DEMOS_CURRENT}}', page === 'diagram' ? 'aria-current="location"' : '')
  .replace('{{RESEARCH_CURRENT}}', page === 'work' ? 'aria-current="location"' : '');
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const faviconUrl = `./favicon.svg?v=${fingerprint(await read('site/favicon.svg'))}`;
const canonical = template.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
if (!canonical) throw new Error('Project QR code needs the canonical project URL');
const projectUrl = new URL(canonical);
if (projectUrl.protocol !== 'https:') throw new Error('Project QR code must use an HTTPS URL');
const qrCss = await read('site/qr-share.css');
const qrOptions = { errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
const qrSvg = await QRCode.toString(projectUrl.href, { ...qrOptions, type: 'svg' });
const qrMarkup = (await read('site/qr-share.html'))
  .replaceAll('{{PROJECT_URL}}', escape(projectUrl.href))
  .replace('{{PROJECT_DISPLAY_URL}}', escape(`${projectUrl.hostname}${projectUrl.pathname}`))
  .replace('./project-qr.svg', `./project-qr.svg?v=${fingerprint(qrSvg)}`);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.accessed)
    || !Number.isFinite(Date.parse(`${source.accessed}T00:00:00Z`))
    || new Date(`${source.accessed}T00:00:00Z`).toISOString().slice(0, 10) !== source.accessed) {
    throw new Error(`Source ${source.id} has an invalid access date`);
  }
  ids.add(source.id);
}

const { html: rendered, headings, cited } = renderResearch(report, ids);
const resolvePaperLink = href => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
  const resolved = new URL(href, 'https://publication.invalid/research/replication-blueprint.md');
  return `.${resolved.pathname}${resolved.search}${resolved.hash}`;
};
const blueprint = renderResearch(replicationPaper, ids, {
  citationPrefix: './index.html#ref-',
  resolveLink: resolvePaperLink,
});
for (const id of ids) if (!cited.has(id) && !blueprint.cited.has(id)) throw new Error(`Uncited source: ${id}`);
const references = sources.map(source =>
  `<li id="ref-${source.id}"><span class="source-id">${source.id} / ${escape(source.year)}</span>
  <p><strong>${escape(source.author)}.</strong> <a href="${escape(source.url)}">${escape(source.title)}</a></p>
  <p>${escape(source.claim)}</p><p class="limit"><strong>Limit:</strong> ${escape(source.limit)} <span>Accessed ${escape(source.accessed)}.</span></p></li>`
).join('\n');
const contents = `<ol>${headings.map(({ id, text }) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ol>`;
const html = template.replace('{{REPORT}}', rendered).replace('{{CONTENTS}}', contents)
  .replace('{{HEADER}}', renderHeader('main'))
  .replace('{{PROJECT_QR}}', qrMarkup)
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('{{REFERENCES}}', references).replace('{{SOURCE_COUNT}}', sources.length)
  .replace('href="./styles.css"', `href="./styles.css?v=${fingerprint(stylesheet)}"`)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./qr-share.css"', `href="./qr-share.css?v=${fingerprint(qrCss)}"`)
  .replace('src="./app.mjs"', `src="./app.mjs?v=${fingerprint(app)}"`);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/project-qr.svg', root), qrSvg);
await writeFile(new URL('dist/project-qr.png', root), await QRCode.toBuffer(projectUrl.href, { ...qrOptions, type: 'png', width: 512 }));
await writeFile(new URL('dist/qr-share.css', root), qrCss);
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
const bibliography = sources.map(s => `- **${s.id}.** ${s.author} (${s.year}). [${s.title}](${s.url}). ${s.claim} Limit: ${s.limit} Accessed ${s.accessed}.`).join('\n\n');
await writeFile(new URL('dist/report.md', root), `${report}\n\n## References\n\n${bibliography}\n`);
await writeFile(new URL('dist/sources.json', root), JSON.stringify(sources, null, 2));
await copyFile(new URL('examples/knowledge-object.json', root), new URL('dist/knowledge-object.json', root));
await copyFile(new URL('examples/reputation-observation.json', root), new URL('dist/reputation-observation.json', root));
await copyFile(new URL('examples/component-passport.json', root), new URL('dist/component-passport.json', root));
await copyFile(new URL('examples/service-operator-economics.json', root), new URL('dist/service-operator-economics.json', root));

const presentation = createPresentationData({
  report, headings, template, diagramTemplate, work, sources,
  additionalSections: [
    createCompanionSection(replicationPaper, { id: 'paper-replication-blueprint', url: './blueprint.html#abstract' }),
    usageAuditSection(usageAudit),
  ],
  revision: {
    contentHash: fingerprint([report, replicationPaper, template, diagramTemplate, workSource, usageSource, JSON.stringify(sources)].join('\0')),
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
  .replace('{{PROJECT_QR}}', qrMarkup)
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./overview.css"', `href="./overview.css?v=${fingerprint(overviewCss)}"`)
  .replace('href="./qr-share.css"', `href="./qr-share.css?v=${fingerprint(qrCss)}"`)
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

const auditCss = await read('site/ai-usage.css');
const auditPage = (await read('site/ai-usage.html'))
  .replace('{{HEADER}}', renderHeader('work'))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./styles.css"', `href="./styles.css?v=${fingerprint(stylesheet)}"`)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./ai-usage.css"', `href="./ai-usage.css?v=${fingerprint(auditCss)}"`)
  .replace('{{AUDIT}}', renderUsageAudit(usageAudit));
if (/\{\{[A-Z_]+\}\}/.test(auditPage)) throw new Error('Unresolved AI-usage template placeholder');
await writeFile(new URL('dist/ai-usage.html', root), auditPage);
await writeFile(new URL('dist/ai-usage.css', root), auditCss);
await writeFile(new URL('dist/ai-usage.json', root), usageSource);
await copyFile(new URL('usage/audit-config.json', root), new URL('dist/usage-audit-config.json', root));
await copyFile(new URL('vendor/usage-calc/UPSTREAM.json', root), new URL('dist/usage-calc-provenance.json', root));
await copyFile(new URL('usage/README.md', root), new URL('dist/usage-method.md', root));

const paperCss = await read('site/paper.css');
const paperContents = `<ol>${blueprint.headings.map(({ id, text }) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ol>`;
const blueprintPage = (await read('site/paper.html'))
  .replace('{{TITLE}}', 'Replicable sector collectives')
  .replace('{{HEADER}}', renderHeader('work'))
  .replaceAll('./favicon.svg', faviconUrl)
  .replace('href="./styles.css"', `href="./styles.css?v=${fingerprint(stylesheet)}"`)
  .replace('href="./header.css"', `href="./header.css?v=${fingerprint(headerCss)}"`)
  .replace('href="./paper.css"', `href="./paper.css?v=${fingerprint(paperCss)}"`)
  .replace('{{MARKDOWN_URL}}', './research/replication-blueprint.md')
  .replace('{{CONTENTS}}', paperContents)
  .replace('{{PAPER}}', blueprint.html);
if (/\{\{[A-Z_]+\}\}/.test(blueprintPage)) throw new Error('Unresolved blueprint template placeholder');
await writeFile(new URL('dist/blueprint.html', root), blueprintPage);
await writeFile(new URL('dist/paper.css', root), paperCss);
await mkdir(new URL('dist/templates/', root), { recursive: true });
await mkdir(new URL('dist/research/', root), { recursive: true });
await mkdir(new URL('dist/examples/', root), { recursive: true });
await mkdir(new URL('dist/test/', root), { recursive: true });
for (const file of sectorProfile.packFiles) {
  const source = new URL(file, new URL('templates/', root));
  if (!source.href.startsWith(root.href)) throw new Error(`Template pack file is outside the project: ${file}`);
  const relative = source.href.slice(root.href.length);
  if (!/^(templates|research|examples|test)\/.+\.(md|json|mjs)$/i.test(relative)) {
    throw new Error(`Unsupported template pack artifact: ${file}`);
  }
  await copyFile(source, new URL(`dist/${relative}`, root));
}
await copyFile(new URL('LICENSE', root), new URL('dist/LICENSE', root));
const paperBibliography = sources.filter(source => blueprint.cited.has(source.id))
  .map(s => `- **${s.id}.** ${s.author} (${s.year}). [${s.title}](${s.url}). ${s.claim} Limit: ${s.limit} Accessed ${s.accessed}.`).join('\n\n');
await writeFile(new URL('dist/research/replication-blueprint.md', root), `${replicationPaper}\n\n## Source register\n\n${paperBibliography}\n`);
await writeFile(new URL('dist/.nojekyll', root), '');
console.log(`Built ${headings.length} report sections, a companion paper, ${sources.length} cited sources, and ${presentation.workItems.length} linked work items.`);
