export class PresentationDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PresentationDataError';
  }
}

function requireValue(condition, message) {
  if (!condition) throw new PresentationDataError(message);
}

function text(value, name) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `Missing or invalid ${name}.`);
  return value;
}

function object(value, name) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `Invalid ${name}.`);
  return value;
}

function array(value, name) {
  requireValue(Array.isArray(value), `Invalid ${name}.`);
  return value;
}

export function safeSourceUrl(value, baseUrl) {
  text(value, 'source URL');
  requireValue(!/[\u0000-\u0020\u007f]/u.test(value), 'Invalid source URL.');
  let url;
  let base;
  try {
    base = new URL(baseUrl);
    url = new URL(value, base);
  } catch {
    throw new PresentationDataError('Invalid source URL.');
  }
  requireValue(
    ['http:', 'https:'].includes(url.protocol) &&
      url.origin === base.origin && !url.username && !url.password,
    'Source URLs must use the same origin as this presentation.',
  );
  return url.href;
}

function unique(items, name) {
  const ids = new Set();
  for (const item of items) {
    text(item.id, `${name} ID`);
    requireValue(!ids.has(item.id), `Duplicate ${name} ID: ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

export function validatePresentationData(input, baseUrl) {
  object(input, 'presentation data');
  requireValue(input.schemaVersion === 1, 'Unsupported presentation data schema.');
  const project = object(input.project, 'project');
  const revision = object(input.revision, 'revision');
  const featured = object(input.featured, 'featured sections');
  for (const key of ['title', 'subtitle', 'thesis', 'status']) text(project[key], `project ${key}`);
  text(revision.contentHash, 'revision hash');
  text(revision.builtAt, 'publication time');
  requireValue(
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(revision.builtAt) &&
      Number.isFinite(Date.parse(revision.builtAt)),
    'Invalid publication time.',
  );
  requireValue(revision.commit === null || (typeof revision.commit === 'string' && revision.commit.trim().length > 0),
    'Invalid revision commit.');
  requireValue(Number.isSafeInteger(input.sourceCount) && input.sourceCount >= 0, 'Invalid source count.');
  const sections = array(input.sections, 'research sections').map((entry) => {
    const section = object(entry, 'research section');
    text(section.title, 'section title');
    const paragraphs = array(section.paragraphs, 'section paragraphs').map((paragraph) => text(paragraph, 'source paragraph'));
    return { id: section.id, title: section.title, url: safeSourceUrl(section.url, baseUrl), paragraphs };
  });
  const sectionIds = unique(sections, 'section');
  const sectionUrls = new Map(sections.map(section => [section.id, section.url]));
  for (const name of ['abstract', 'approach', 'questions', 'nextSteps']) {
    requireValue(sectionIds.has(featured[name]), `Missing featured section: ${name}.`);
  }
  const demos = array(input.demos, 'demos').map((entry) => {
    const demo = object(entry, 'demo');
    return {
      id: demo.id,
      title: text(demo.title, 'demo title'),
      description: text(demo.description, 'demo description'),
      url: safeSourceUrl(demo.url, baseUrl),
      ...(demo.imageUrl === undefined ? {} : { imageUrl: safeSourceUrl(demo.imageUrl, baseUrl) }),
    };
  });
  unique(demos, 'demo');
  const workItems = array(input.workItems, 'work items').map((entry) => {
    const item = object(entry, 'work item');
    requireValue(['open', 'in-progress', 'blocked', 'done'].includes(item.status), 'Invalid work status.');
    const sourceIds = array(item.sourceIds, 'work source IDs').map((id) => {
      requireValue(sectionIds.has(id), `Unknown work source section: ${id}.`);
      return id;
    });
    const sourceUrls = array(item.sourceUrls, 'work source URLs').map((url) => safeSourceUrl(url, baseUrl));
    requireValue(sourceIds.length === sourceUrls.length, 'Work source IDs and URLs must correspond.');
    requireValue(sourceIds.every((id, index) => sectionUrls.get(id) === sourceUrls[index]),
      'Work source URLs must match their identified research sections.');
    return {
      id: item.id,
      title: text(item.title, 'work title'),
      question: text(item.question, 'work question'),
      status: item.status,
      nextStep: text(item.nextStep, 'work next step'),
      sourceIds,
      sourceUrls,
    };
  });
  unique(workItems, 'work item');
  return {
    schemaVersion: 1,
    project: { ...project, reportUrl: safeSourceUrl(project.reportUrl, baseUrl) },
    revision: { ...revision },
    sections,
    featured: { ...featured },
    demos,
    workItems,
    sourceCount: input.sourceCount,
    workUrl: safeSourceUrl(input.workUrl, baseUrl),
  };
}

export function sourceExcerpt(section, limit = 620) {
  const original = section.paragraphs[0] ?? '';
  if (original.length <= limit) return { text: original, shortened: false };
  const candidate = original.slice(0, limit);
  const lastSpace = candidate.lastIndexOf(' ');
  return { text: `${candidate.slice(0, lastSpace > limit / 2 ? lastSpace : limit)}…`, shortened: true };
}

export function createSlideModel(input, baseUrl) {
  const data = validatePresentationData(input, baseUrl);
  const sectionById = new Map(data.sections.map((section) => [section.id, section]));
  const featured = Object.fromEntries(Object.entries(data.featured).map(([key, id]) => [key, sectionById.get(id)]));
  const counts = { open: 0, 'in-progress': 0, blocked: 0, done: 0, total: data.workItems.length, active: 0 };
  for (const item of data.workItems) {
    counts[item.status] += 1;
    if (item.status !== 'done') counts.active += 1;
  }
  const activeWork = data.workItems.filter((item) => item.status !== 'done');
  return {
    ...data,
    counts,
    sectionById,
    slides: [
      { id: 'project', label: 'Project', title: data.project.title, section: featured.abstract },
      { id: 'approach', label: 'Approach', title: featured.approach.title, section: featured.approach },
      { id: 'research', label: 'Research', title: featured.questions.title, section: featured.questions, sections: data.sections },
      { id: 'demos', label: 'Demos', title: 'Explore the demonstrations', demos: data.demos },
      { id: 'work', label: 'Open work', title: 'Questions & work', items: data.workItems, activeItems: activeWork },
      { id: 'next', label: 'Next steps', title: featured.nextSteps.title, section: featured.nextSteps, items: activeWork },
    ],
  };
}

export function refreshViewState(phase, { checkedAt, error } = {}) {
  requireValue(['loading', 'current', 'error'].includes(phase), 'Invalid refresh phase.');
  if (phase === 'current') {
    requireValue(checkedAt instanceof Date && Number.isFinite(checkedAt.getTime()), 'A successful refresh needs its check time.');
  }
  return {
    phase,
    showDeck: phase === 'current',
    isBusy: phase === 'loading',
    showError: phase === 'error',
    status: phase === 'current'
      ? `Published revision loaded · checked ${checkedAt.toLocaleTimeString()}`
      : phase === 'loading'
        ? 'Checking the latest published presentation…'
        : 'Refresh failed · current publication is unverified',
    errorMessage: phase !== 'error' ? '' : error?.name === 'AbortError'
      ? 'The publication request timed out. Please retry.'
      : `The presentation could not be loaded. ${error?.message || 'Please check your connection and retry.'}`,
  };
}

export async function fetchPresentationData({
  baseUrl,
  fetchImpl = globalThis.fetch,
  signal,
  timestamp = Date.now(),
} = {}) {
  const url = new URL('./presentation-data.json', baseUrl);
  url.searchParams.set('_', String(timestamp));
  const response = await fetchImpl(url.href, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new PresentationDataError(`Publication request failed (HTTP ${response.status}).`);
  let input;
  try {
    input = await response.json();
  } catch {
    throw new PresentationDataError('The publication returned invalid JSON.');
  }
  return createSlideModel(input, baseUrl);
}
