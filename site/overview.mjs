import { fetchPresentationData, refreshViewState, sourceExcerpt } from './presentation-model.mjs';

const byId = (id) => document.getElementById(id);
const deck = byId('deck');
const slidesRoot = byId('slides');
const chaptersRoot = byId('chapters');
const statusPanel = document.querySelector('.publication-status');
const statusText = byId('freshness-status');
const revisionText = byId('revision');
const refreshButton = byId('refresh');
const printButton = byId('print-overview');
let model;
let activeSlide = 0;
let pendingRefresh;
let lastChecked;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label, href) {
  const node = element('a', '', label);
  node.href = href;
  return node;
}

function sourceLinks(entries) {
  const links = element('div', 'source-links');
  for (const [label, url] of entries) links.append(link(label, url));
  return links;
}

function sourceContent(section) {
  const content = element('div', 'source-content');
  content.append(element('p', 'source-label', 'Published source text · citations and formatting in the report'));
  if (!section.paragraphs.length) content.append(element('p', '', 'No plain-text paragraphs are included for this section. Open the report for its complete content.'));
  for (const paragraph of section.paragraphs) content.append(element('p', '', paragraph));
  content.append(sourceLinks([['Open the complete cited section →', section.url]]));
  return content;
}

function sourceDetail(section, key, label = 'Read all extracted source text') {
  const details = element('details', 'source-detail');
  details.dataset.disclosure = key;
  details.append(element('summary', '', label), sourceContent(section));
  return details;
}

function appendExcerpt(container, section, key) {
  const excerpt = sourceExcerpt(section);
  container.append(element('p', 'source-label', excerpt.shortened ? 'Source excerpt · shortened, not a summary' : 'Source excerpt · not a summary'));
  if (excerpt.text) {
    const quote = element('blockquote', 'source-excerpt');
    quote.cite = section.url;
    quote.append(element('p', '', excerpt.text));
    container.append(quote);
  } else {
    container.append(element('p', 'source-content', 'Open this source section for its full content.'));
  }
  container.append(
    sourceLinks([['Read the complete cited section →', section.url]]),
    sourceDetail(section, key),
  );
}

function stats(entries) {
  const list = element('dl', 'stats');
  for (const [label, value] of entries) {
    const item = element('div');
    item.append(element('dt', '', label), element('dd', '', String(value)));
    list.append(item);
  }
  return list;
}

function researchBrowser(sections) {
  const browser = element('details', 'research-browser');
  browser.dataset.disclosure = 'all-research';
  browser.append(element('summary', '', `Browse all ${sections.length} research sections`));
  const label = element('label', 'search-label', 'Find a section by title or source text');
  label.htmlFor = 'research-search';
  const input = element('input', 'research-search');
  input.id = 'research-search';
  input.type = 'search';
  input.placeholder = 'Filter the published research…';
  input.autocomplete = 'off';
  const count = element('p', 'filter-count');
  count.setAttribute('role', 'status');
  const list = element('ul', 'research-list');
  const entries = sections.map((section) => {
    const item = element('li');
    item.append(sourceDetail(section, `research-${section.id}`, section.title));
    list.append(item);
    return { node: item, search: `${section.title} ${section.paragraphs.join(' ')}`.toLocaleLowerCase() };
  });
  const applyFilter = () => {
    const query = input.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const entry of entries) {
      entry.node.hidden = !entry.search.includes(query);
      if (!entry.node.hidden) shown += 1;
    }
    count.textContent = `${shown} of ${sections.length} sections${shown === 0 ? ' · No matches. Try another search.' : ''}`;
  };
  input.addEventListener('input', applyFilter);
  applyFilter();
  browser.append(label, input, count, list);
  return browser;
}

function workCard(item, data, compact = false) {
  const card = element('article', 'work-card');
  card.append(
    element('p', 'work-status', item.status.replaceAll('-', ' ')),
    element('h3', '', item.title),
    element('p', 'work-question', item.question),
  );
  if (!compact) {
    card.append(element('h4', '', 'Next step in the source register'), element('p', '', item.nextStep));
    if (item.sourceUrls.length) {
      const sources = element('ul', 'source-links');
      item.sourceUrls.forEach((url, index) => {
        const source = element('li');
        source.append(link(data.sectionById.get(item.sourceIds[index]).title, url));
        sources.append(source);
      });
      card.append(sources);
    }
  }
  const itemUrl = new URL(data.workUrl);
  itemUrl.hash = item.id;
  card.append(link('View this work item →', itemUrl.href));
  return card;
}

function renderProject(slide, data, article) {
  article.querySelector('h2').classList.add('project-title');
  article.append(
    element('p', 'project-subtitle', data.project.subtitle),
    element('p', 'project-thesis', data.project.thesis),
    element('p', 'project-status', data.project.status),
    sourceLinks([['Read the source report →', data.project.reportUrl]]),
    sourceDetail(slide.section, 'project-abstract', `Read the source: ${slide.section.title}`),
  );
}

function renderDemos(slide, article) {
  const grid = element('div', 'card-grid');
  for (const demo of slide.demos) {
    const card = element('article', 'demo-card');
    if (demo.imageUrl) {
      const image = element('img');
      image.src = demo.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      card.append(image);
    }
    card.append(
      element('h3', '', demo.title),
      element('p', 'source-label', 'Description from the published demonstration'),
      element('p', '', demo.description),
      link('Open this demonstration →', demo.url),
    );
    grid.append(card);
  }
  article.append(stats([['Published demonstrations', slide.demos.length]]), grid);
  if (!slide.demos.length) article.append(element('p', 'source-content', 'No demonstrations are listed in this published revision.'));
}

function renderWork(slide, data, article) {
  article.append(stats([
    ['Open', data.counts.open],
    ['In progress', data.counts['in-progress']],
    ['Blocked', data.counts.blocked],
    ['Done', data.counts.done],
  ]));
  if (slide.activeItems.length) {
    article.append(element('p', 'source-label', `From the work register · first ${Math.min(3, slide.activeItems.length)} of ${slide.activeItems.length} unfinished items, in source order`));
    const highlights = element('div', 'card-grid work-highlights');
    for (const item of slide.activeItems.slice(0, 3)) highlights.append(workCard(item, data, true));
    article.append(highlights);
  } else {
    article.append(element('p', 'source-content', slide.items.length ? 'No unfinished items are recorded in this published revision.' : 'No work items are recorded in this published revision.'));
  }
  const browser = element('details', 'work-browser');
  browser.dataset.disclosure = 'all-work';
  browser.append(element('summary', '', `Browse all ${slide.items.length} work items and next steps`));
  const grid = element('div', 'card-grid');
  for (const item of slide.items) grid.append(workCard(item, data));
  browser.append(grid);
  article.append(sourceLinks([['Open the canonical work register →', data.workUrl]]), browser);
}

function renderNext(slide, data, article) {
  appendExcerpt(article, slide.section, 'next-source');
  if (slide.items.length) {
    article.append(element('p', 'source-label', `Next steps from the work register · first ${Math.min(3, slide.items.length)} unfinished items`));
    const list = element('ol', 'next-actions');
    for (const item of slide.items.slice(0, 3)) {
      const entry = element('li');
      entry.append(element('strong', '', item.title), document.createTextNode(item.nextStep));
      list.append(entry);
    }
    article.append(list);
  }
  article.append(sourceLinks([['All recorded next steps →', data.workUrl], ['Return to the research →', data.project.reportUrl]]));
}

function renderSlides(data) {
  const openDetails = new Set([...slidesRoot.querySelectorAll('details[open]')].map((node) => node.dataset.disclosure));
  const query = byId('research-search')?.value ?? '';
  const fragment = document.createDocumentFragment();
  const navigation = document.createDocumentFragment();
  data.slides.forEach((slide, index) => {
    const article = element('section', 'slide');
    article.id = `slide-${slide.id}`;
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', 'slide');
    article.setAttribute('aria-labelledby', `heading-${slide.id}`);
    const heading = element('h2', '', slide.title);
    heading.id = `heading-${slide.id}`;
    heading.tabIndex = -1;
    article.append(element('p', 'eyebrow', `${String(index + 1).padStart(2, '0')} / ${slide.label}`), heading);
    if (slide.id === 'project') renderProject(slide, data, article);
    if (slide.id === 'approach') appendExcerpt(article, slide.section, 'approach-source');
    if (slide.id === 'research') {
      article.append(stats([['Research sections', data.sections.length], ['Sources in the report', data.sourceCount], ['Unfinished work items', data.counts.active]]));
      appendExcerpt(article, slide.section, 'questions-source');
      article.append(researchBrowser(slide.sections));
    }
    if (slide.id === 'demos') renderDemos(slide, article);
    if (slide.id === 'work') renderWork(slide, data, article);
    if (slide.id === 'next') renderNext(slide, data, article);
    fragment.append(article);
    const button = element('button');
    button.type = 'button';
    button.setAttribute('aria-controls', article.id);
    button.append(element('span', 'chapter-number', String(index + 1).padStart(2, '0')), document.createTextNode(slide.label));
    button.addEventListener('click', () => showSlide(index, true));
    navigation.append(button);
  });
  slidesRoot.replaceChildren(fragment);
  chaptersRoot.replaceChildren(navigation);
  for (const details of slidesRoot.querySelectorAll('details')) details.open = openDetails.has(details.dataset.disclosure);
  const search = byId('research-search');
  search.value = query;
  search.dispatchEvent(new Event('input'));
}

function showSlide(index, focus = false) {
  if (!model) return;
  activeSlide = Math.max(0, Math.min(index, model.slides.length - 1));
  [...slidesRoot.children].forEach((slide, position) => { slide.hidden = position !== activeSlide; });
  [...chaptersRoot.children].forEach((button, position) => {
    if (position === activeSlide) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  byId('previous').disabled = activeSlide === 0;
  byId('next').disabled = activeSlide === model.slides.length - 1;
  byId('slide-position').textContent = `${activeSlide + 1} / ${model.slides.length} · ${model.slides[activeSlide].label}`;
  if (focus) slidesRoot.children[activeSlide].querySelector('h2').focus({ preventScroll: false });
}

function revisionLabel(data) {
  const revision = data.revision;
  return `Published ${new Date(revision.builtAt).toLocaleString()} · Revision ${revision.contentHash.slice(0, 12)}${revision.commit ? ` · Commit ${revision.commit.slice(0, 12)}` : ''}`;
}

function setRefreshState(phase, error) {
  const state = refreshViewState(phase, { checkedAt: lastChecked, error });
  deck.hidden = !state.showDeck;
  deck.setAttribute('aria-busy', String(state.isBusy));
  byId('loading-panel').hidden = !state.isBusy;
  byId('load-error').hidden = !state.showError;
  byId('error-message').textContent = state.errorMessage;
  statusPanel.dataset.state = state.phase;
  statusText.textContent = state.status;
  refreshButton.disabled = state.isBusy;
  printButton.disabled = !state.showDeck;
}

function refresh() {
  if (pendingRefresh) return pendingRefresh;
  setRefreshState('loading');
  if (model) revisionText.textContent = `Rechecking · previous successful check ${lastChecked.toLocaleString()} · ${revisionLabel(model)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  pendingRefresh = (async () => {
    try {
      const updated = await fetchPresentationData({ baseUrl: location.href, signal: controller.signal });
      renderSlides(updated);
      model = updated;
      lastChecked = new Date();
      showSlide(activeSlide);
      document.title = `Live overview | ${model.project.title}`;
      revisionText.textContent = revisionLabel(model);
      revisionText.title = `Content hash: ${model.revision.contentHash}${model.revision.commit ? `\nCommit: ${model.revision.commit}` : ''}\nLast successful check: ${lastChecked.toISOString()}`;
      setRefreshState('current');
    } catch (error) {
      setRefreshState('error', error);
      revisionText.textContent = model
        ? `Not current · last successful check ${lastChecked.toLocaleString()} · ${revisionLabel(model)}`
        : 'No published revision could be verified.';
    } finally {
      clearTimeout(timeout);
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

byId('previous').addEventListener('click', () => showSlide(activeSlide - 1, true));
byId('next').addEventListener('click', () => showSlide(activeSlide + 1, true));
refreshButton.addEventListener('click', refresh);
byId('retry').addEventListener('click', refresh);
printButton.addEventListener('click', () => window.print());

document.addEventListener('keydown', (event) => {
  if (deck.hidden || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest('input, textarea, select, summary, [contenteditable]:not([contenteditable="false"])')) return;
  const positions = {
    ArrowLeft: activeSlide - 1,
    PageUp: activeSlide - 1,
    ArrowRight: activeSlide + 1,
    PageDown: activeSlide + 1,
    Home: 0,
    End: model.slides.length - 1,
  };
  if (!Object.hasOwn(positions, event.key)) return;
  event.preventDefault();
  showSlide(positions[event.key], true);
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) refresh();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh();
});
refresh();
