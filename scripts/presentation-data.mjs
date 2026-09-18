import { marked } from 'marked';

const statuses = new Set(['open', 'in-progress', 'blocked', 'done']);
const unnumber = title => title.replace(/^\d+\.\s*/, '');

function plainTokens(tokens) {
  return tokens.map(token => {
    if (token.type === 'html') return '';
    if (token.tokens) return plainTokens(token.tokens);
    if (token.type === 'br') return ' ';
    return token.text ?? '';
  }).join('').replace(/\[S\d{2}\]/g, '').replace(/\s+/g, ' ').trim();
}

function htmlText(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '\u00b7' };
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|middot);/g, (_, name) => entities[name])
    .replace(/\s+/g, ' ').trim();
}

function requiredText(template, pattern, label) {
  const match = template.match(pattern);
  if (!match) throw new Error(`Presentation source is missing ${label}`);
  const text = htmlText(match[1]);
  if (!text) throw new Error(`Presentation source has empty ${label}`);
  return text;
}

export function createPresentationData({ report, headings, template, diagramTemplate, work, sources, revision }) {
  const sections = [];
  let current;
  for (const token of marked.lexer(report)) {
    if (token.type === 'heading' && token.depth === 2) {
      const heading = headings[sections.length];
      if (!heading) throw new Error('Presentation headings do not match the rendered report');
      current = {
        id: heading.id,
        title: plainTokens(token.tokens),
        url: `./index.html#${heading.id}`,
        paragraphs: [],
      };
      sections.push(current);
    } else if (token.type === 'paragraph' && current) {
      const text = plainTokens(token.tokens);
      if (text) current.paragraphs.push(text);
    }
  }
  if (sections.length !== headings.length) throw new Error('Presentation report section count does not match');
  const byTitle = new Map();
  for (const section of sections) {
    const title = unnumber(section.title);
    if (byTitle.has(title)) throw new Error(`Ambiguous presentation source title: ${title}`);
    byTitle.set(title, section);
  }
  const sourceSection = title => {
    const section = byTitle.get(title);
    if (!section) throw new Error(`Unknown research source title: ${title}`);
    return section;
  };

  if (work.schemaVersion !== 1 || !Array.isArray(work.items)) throw new Error('Unsupported open-work source schema');
  if (typeof work.description !== 'string' || !work.description.trim()) {
    throw new Error('Open-work source needs a description');
  }
  const itemIds = new Set();
  const workItems = work.items.map(item => {
    for (const key of ['id', 'title', 'question', 'nextStep']) {
      if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`Open-work item missing ${key}`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || itemIds.has(item.id)) {
      throw new Error(`Invalid or duplicate open-work id: ${item.id}`);
    }
    if (!statuses.has(item.status)) throw new Error(`Invalid open-work status for ${item.id}: ${item.status}`);
    if (!Array.isArray(item.sourceTitles) || !item.sourceTitles.length) {
      throw new Error(`Open-work item ${item.id} needs at least one research source`);
    }
    itemIds.add(item.id);
    const itemSources = item.sourceTitles.map(sourceSection);
    return {
      id: item.id, title: item.title, question: item.question, status: item.status, nextStep: item.nextStep,
      sourceIds: itemSources.map(section => section.id),
      sourceUrls: itemSources.map(section => section.url),
    };
  });

  return {
    schemaVersion: 1,
    project: {
      title: requiredText(template, /<h1 id="title">([\s\S]*?)<\/h1>/, 'project title').replace(/\.$/, ''),
      subtitle: requiredText(template, /<p class="deck">([\s\S]*?)<\/p>/, 'project subtitle'),
      thesis: requiredText(template, /<section class="thesis"[^>]*>[\s\S]*?<p class="eyebrow">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/, 'project thesis'),
      status: requiredText(template, /<span class="status">([\s\S]*?)<\/span>/, 'draft status'),
      reportUrl: './index.html#report',
    },
    revision,
    sections,
    featured: {
      abstract: sourceSection('Abstract').id,
      approach: sourceSection('From digital Costco to a bargaining federation').id,
      questions: sourceSection('Research program and falsifiable hypotheses').id,
      nextSteps: sourceSection('A ninety-day starting sequence').id,
    },
    demos: [
      {
        id: 'divergence',
        title: requiredText(diagramTemplate, /<h1>([\s\S]*?)<\/h1>/, 'diagram title'),
        description: requiredText(diagramTemplate, /<p class="lede">([\s\S]*?)<\/p>/, 'diagram description'),
        url: './divergence.html',
        imageUrl: './divergence.svg',
      },
      {
        id: 'settlement',
        title: requiredText(template, /<h2 id="lab-title">([\s\S]*?)<\/h2>/, 'calculator title'),
        description: requiredText(template, /<h2 id="lab-title">[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/, 'calculator description'),
        url: './index.html#lab',
      },
    ],
    workItems,
    sourceCount: sources.length,
    workUrl: './open-work.html',
  };
}
