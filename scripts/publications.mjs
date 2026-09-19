const sourcePattern = /^(research|papers)\/[a-z0-9-]+\.md$/;

export function validatePublications(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.public) || !Array.isArray(manifest.repositoryOnly)) {
    throw new Error('Unsupported publication manifest');
  }
  const privateSources = new Set();
  for (const item of manifest.repositoryOnly) {
    if (!sourcePattern.test(item.source) || !item.reason || privateSources.has(item.source)) {
      throw new Error('Invalid repository-only publication entry');
    }
    privateSources.add(item.source);
  }
  const ids = new Set();
  const outputs = new Set(['index.html', 'overview.html', 'open-work.html', 'workshop.html', 'divergence.html', 'ai-usage.html']);
  const sources = new Set();
  for (const item of manifest.public) {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id)
      || !sourcePattern.test(item.source) || sources.has(item.source)
      || !/^[a-z][a-z0-9-]*\.html$/.test(item.output) || outputs.has(item.output)
      || typeof item.title !== 'string' || !item.title.trim()) {
      throw new Error('Invalid or duplicate public-paper entry');
    }
    if (privateSources.has(item.source)) throw new Error('A repository-only draft cannot be published');
    ids.add(item.id);
    sources.add(item.source);
    outputs.add(item.output);
  }
  return manifest;
}

export function publicationLink(href, source, manifest) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) {
    if (manifest.repositoryOnly.some(item => href.includes(item.source))) {
      throw new Error('Public paper links to a repository-only draft');
    }
    return href;
  }
  const url = new URL(href, `https://publication.invalid/${source}`);
  const relative = url.pathname.slice(1);
  if (manifest.repositoryOnly.some(item => item.source === relative)) {
    throw new Error('Public paper links to a repository-only draft');
  }
  const paper = manifest.public.find(item => item.source === relative);
  if (paper) return `./${paper.output}${url.search}${url.hash}`;
  const aliases = new Map([
    ['research/report.md', 'report.md'],
    ['research/workshop-statements.json', 'workshop-statements.json'],
    ['research/workshop-map.json', 'workshop-map.json'],
    ['research/conference-notes-review.json', 'conference-notes-review.json'],
    ['research/open-work.json', 'open-work.json'],
    ['examples/knowledge-object.json', 'knowledge-object.json'],
    ['examples/reputation-observation.json', 'reputation-observation.json'],
    ['examples/component-passport.json', 'component-passport.json'],
    ['examples/service-operator-economics.json', 'service-operator-economics.json'],
  ]);
  return `./${aliases.get(relative) ?? relative}${url.search}${url.hash}`;
}

export function assertNoRepositoryOnlyReferences(text, manifest) {
  for (const item of manifest.repositoryOnly) {
    const filename = item.source.split('/').at(-1);
    if (text.includes(item.source) || text.includes(filename)) {
      throw new Error(`Repository-only draft leaked into a public artifact: ${filename}`);
    }
  }
}
