import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const unnumber = title => title.replace(/^\d+\.\s*/, '');
const imagePath = value => {
  if (!/^\.\/assets\/workshop\/[a-z0-9-]+\.png$/.test(value)) throw new Error('Workshop image must use the local source-image directory');
  return value.slice(2);
};

export function attribution(card) {
  const label = card.attributionAsPrinted;
  return card.affiliationAsPrinted && !label.includes(card.affiliationAsPrinted)
    ? `${label} (${card.affiliationAsPrinted})` : label;
}

export function validateWorkshop(data, mapping, headings) {
  if (data.schemaVersion !== 1 || mapping.schemaVersion !== 1) throw new Error('Unsupported workshop source schema');
  const source = data.source;
  if (!source || !/^[a-f0-9]{64}$/i.test(source.originalSha256)) throw new Error('Workshop source needs its original-image checksum');
  for (const key of ['description', 'contextDate', 'dateBasis', 'rightsNote', 'transcriptionNote']) {
    if (typeof source[key] !== 'string' || !source[key].trim()) throw new Error(`Workshop source missing ${key}`);
  }
  for (const key of ['width', 'height']) {
    if (!Number.isSafeInteger(source[key]) || source[key] <= 0) throw new Error(`Invalid workshop image ${key}`);
  }
  imagePath(source.imageUrl);
  if (!Array.isArray(data.cards) || !data.cards.length) throw new Error('Workshop source has no cards');
  if (data.cards.filter(card => card.kind === 'brief').length !== 1) throw new Error('Workshop source needs exactly one overall brief');
  const cards = new Map();
  for (const card of data.cards) {
    if (!/^[a-z][a-z0-9-]*$/.test(card.id) || cards.has(card.id)) throw new Error('Invalid or duplicate workshop card ID');
    if (!['brief', 'individual'].includes(card.kind)) throw new Error('Invalid workshop card kind');
    for (const key of ['title', 'attributionAsPrinted', 'transcription']) {
      if (typeof card[key] !== 'string' || !card[key].trim()) throw new Error(`Workshop card ${card.id} missing ${key}`);
    }
    if (card.affiliationAsPrinted !== null && typeof card.affiliationAsPrinted !== 'string') throw new Error('Invalid printed affiliation');
    if (!Array.isArray(card.uncertainties) || card.uncertainties.some(value => typeof value !== 'string' || !value.trim())) {
      throw new Error('Workshop transcription uncertainty must be explicit');
    }
    imagePath(card.cropUrl);
    if (!card.crop || !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(card.crop[key]))) {
      throw new Error('Workshop crop needs integer source coordinates');
    }
    const { x, y, width, height } = card.crop;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > source.width || y + height > source.height) {
      throw new Error(`Workshop crop ${card.id} exceeds the source image`);
    }
    cards.set(card.id, card);
  }
  const sections = new Map(headings.map(heading => [unnumber(heading.text.replace(/<[^>]*>/g, '')), heading]));
  const mappings = new Map();
  for (const item of mapping.mappings) {
    if (!cards.has(item.cardId) || mappings.has(item.cardId)) throw new Error('Workshop mapping has an unknown or duplicate card');
    if (!sections.has(item.primaryTitle)) throw new Error(`Workshop primary section missing: ${item.primaryTitle}`);
    if (!item.summary || !item.coverage || !Array.isArray(item.directions) || !item.directions.length) {
      throw new Error('Workshop mapping needs a summary, coverage assessment, and directions');
    }
    for (const direction of item.directions) {
      if (!direction.label || !Array.isArray(direction.sectionTitles) || !direction.sectionTitles.length) {
        throw new Error('Workshop direction needs a label and linked research');
      }
      for (const title of direction.sectionTitles) {
        if (!sections.has(title)) throw new Error(`Workshop research section missing: ${title}`);
      }
    }
    mappings.set(item.cardId, item);
  }
  if (mappings.size !== cards.size) throw new Error('Every workshop card must have an explicit coverage mapping');
  if (!/^S\d{2}$/.test(mapping.sourceId)) throw new Error('Workshop source needs a registered source ID');
  return { data, mapping, cards, mappings, sections };
}

export async function loadWorkshopAssets(workshop, root) {
  const expected = new Map([[workshop.data.source.imageUrl, {
    width: workshop.data.source.width, height: workshop.data.source.height,
  }]]);
  for (const card of workshop.cards.values()) {
    if (expected.has(card.cropUrl)) throw new Error('Each workshop crop needs its own asset');
    expected.set(card.cropUrl, card.crop);
  }
  const assets = new Map();
  for (const [url, dimensions] of expected) {
    const relative = imagePath(url);
    const bytes = await readFile(new URL(`site/${relative}`, root));
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.readUInt32BE(16) !== dimensions.width || bytes.readUInt32BE(20) !== dimensions.height) {
      throw new Error(`Workshop PNG dimensions differ from its declared source: ${url}`);
    }
    let offset = 8;
    while (offset < bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) throw new Error(`Workshop image retains textual/EXIF metadata: ${url}`);
      offset += length + 12;
    }
    if (offset !== bytes.length) throw new Error(`Malformed workshop PNG: ${url}`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assets.set(url, { relative, bytes, hash, versionedUrl: `${url}?v=${hash.slice(0, 12)}` });
  }
  return assets;
}

function sectionLinks(workshop, titles, inReport) {
  return [...new Set(titles)].map(title => {
    const section = workshop.sections.get(title);
    return `<a href="${inReport ? '#' : './index.html#'}${escape(section.id)}">${escape(section.text.replace(/<[^>]*>/g, ''))}</a>`;
  }).join(' · ');
}

function citation(workshop, inReport) {
  const id = workshop.mapping.sourceId;
  return `<sup><a href="${inReport ? '#' : './index.html#'}ref-${id}" aria-label="Source ${id}">[${id}]</a></sup>`;
}

export function renderWorkshopCard(workshop, assets, id, { inReport = false } = {}) {
  const card = workshop.cards.get(id);
  const map = workshop.mappings.get(id);
  if (!card || !map) throw new Error(`Unknown workshop card: ${id}`);
  const prefix = inReport ? 'workshop-' : 'source-';
  const directions = map.directions.map(direction =>
    `<li><strong>${escape(direction.label)}</strong><br>${sectionLinks(workshop, direction.sectionTitles, inReport)}</li>`).join('');
  return `<section class="workshop-card" id="${prefix}${escape(id)}">
    <p class="workshop-kicker">${card.kind === 'brief' ? 'Overall group brief' : 'Photographed direction'} / source transcription</p>
    <h3>${escape(card.kind === 'brief' ? card.title : attribution(card))}</h3>
    <div class="workshop-card-layout">
      <figure><a href="${assets.get(card.cropUrl).versionedUrl}"><img src="${assets.get(card.cropUrl).versionedUrl}" width="${card.crop.width}" height="${card.crop.height}" loading="lazy" decoding="async" alt="Full crop of the printed card attributed to ${escape(card.attributionAsPrinted)}"></a>
      <figcaption>Attribution as printed: ${escape(attribution(card))}. Open the crop to inspect it.</figcaption></figure>
      <div><blockquote class="workshop-transcription"><p>${escape(card.transcription).replace(/\n/g, '<br>')}</p></blockquote>
      ${card.uncertainties.length ? `<p class="workshop-uncertainty"><strong>Transcription uncertainty:</strong> ${card.uncertainties.map(escape).join(' ')}</p>` : ''}
      <p class="workshop-caption">This records a printed card, not a verified spoken quotation or endorsement. ${citation(workshop, inReport)}</p></div>
    </div>
    <details><summary>Editorial alignment and coverage</summary><p>${escape(map.summary)}</p><p>${escape(map.coverage)}</p><ul>${directions}</ul></details>
    ${inReport ? `<p class="workshop-caption"><a href="./workshop.html#source-${escape(id)}">View source context and full mapping</a></p>` : ''}
  </section>`;
}

export function renderWorkshopCrosswalk(workshop, inReport = false) {
  const rows = [...workshop.cards.values()].filter(card => card.kind === 'individual').map(card => {
    const map = workshop.mappings.get(card.id);
    return `<tr><td>${escape(attribution(card))}</td><td>${escape(map.summary)}</td>
      <td>${sectionLinks(workshop, [map.primaryTitle], inReport)}<br><a href="${inReport ? '#' : './index.html#'}workshop-${escape(card.id)}">Read the aligned card</a></td></tr>`;
  }).join('');
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="Workshop directions mapped to research"><table>
    <thead><tr><th scope="col">Printed attribution</th><th scope="col">Editorial direction summary</th><th scope="col">Primary research placement</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function renderWorkshopOriginal(workshop, assets, inReport = false) {
  const source = workshop.data.source;
  return `<figure class="workshop-original"><a href="${assets.get(source.imageUrl).versionedUrl}">
    <img src="${assets.get(source.imageUrl).versionedUrl}" width="${source.width}" height="${source.height}" loading="lazy" decoding="async" alt="User-provided workshop photograph with the central Collective Bargaining and Institutions brief and attributed direction cards"></a>
    <figcaption>${escape(source.description)} ${escape(source.rightsNote)} ${citation(workshop, inReport)}</figcaption></figure>`;
}

export function expandWorkshopMarkers(text, workshop, assets) {
  const seen = new Set();
  const expanded = text.replace(/<!--\s*workshop:([a-z0-9-]+)\s*-->/g, (_, id) => {
    if (seen.has(id)) throw new Error(`Duplicate workshop placement: ${id}`);
    seen.add(id);
    if (id === 'brief') {
      return `${renderWorkshopOriginal(workshop, assets, true)}\n${renderWorkshopCard(workshop, assets, id, { inReport: true })}\n${renderWorkshopCrosswalk(workshop, true)}`;
    }
    return renderWorkshopCard(workshop, assets, id, { inReport: true });
  });
  if (/<!--\s*workshop:/i.test(expanded) || seen.size !== workshop.cards.size) {
    throw new Error('All workshop cards need exactly one explicit report placement');
  }
  return expanded;
}

export function validateWorkshopPlacements(report, workshop) {
  let currentTitle;
  const placed = new Set();
  for (const line of report.split(/\r?\n/)) {
    if (line.startsWith('## ')) currentTitle = unnumber(line.slice(3));
    const marker = line.match(/<!--\s*workshop:([a-z0-9-]+)\s*-->/);
    if (!marker) continue;
    const item = workshop.mappings.get(marker[1]);
    if (!item || item.primaryTitle !== currentTitle || placed.has(marker[1])) {
      throw new Error(`Workshop card is not uniquely placed in its mapped section: ${marker[1]}`);
    }
    placed.add(marker[1]);
  }
  if (placed.size !== workshop.cards.size) throw new Error('Workshop report placements are incomplete');
}

export function workshopPresentationSection(workshop) {
  return {
    id: 'source-workshop-directions',
    title: 'Workshop photograph: brief and attributed directions',
    url: './workshop.html#source-brief',
    paragraphs: [
      workshop.mapping.scopeNote,
      workshop.data.source.transcriptionNote,
      ...[...workshop.cards.values()].map(card => `${attribution(card)}: ${card.transcription}`),
    ],
  };
}

export function validateConferenceReview(review, workshop) {
  if (review.schemaVersion !== 1 || !/^S\d{2}$/.test(review.sourceId)) throw new Error('Invalid conference-note review schema');
  for (const key of ['sourceTitle', 'contextDate', 'reviewedOn', 'authorLineAsProvided', 'accessBasis', 'attributionNote', 'assessment']) {
    if (typeof review[key] !== 'string' || !review[key].trim()) throw new Error(`Conference review missing ${key}`);
  }
  if (!Array.isArray(review.directions) || !review.directions.length) throw new Error('Conference review needs distinct directions');
  const ids = new Set();
  for (const item of review.directions) {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id)) throw new Error('Invalid or duplicate conference direction');
    ids.add(item.id);
    for (const key of ['attributionAsProvided', 'sourceWording', 'response']) {
      if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`Conference direction missing ${key}`);
    }
    if (!Array.isArray(item.sectionTitles) || !item.sectionTitles.length) throw new Error('Conference direction needs linked research');
    for (const title of item.sectionTitles) {
      if (!workshop.sections.has(title)) throw new Error(`Conference research section missing: ${title}`);
    }
  }
  return review;
}

export function renderConferenceReview(review, workshop) {
  return `<p><strong>Source:</strong> ${escape(review.sourceTitle)} (${escape(review.contextDate)}). Supplied excerpt reviewed ${escape(review.reviewedOn)}.</p>
    <p><strong>Author line as supplied:</strong> ${escape(review.authorLineAsProvided)}.</p>
    <p>${escape(review.accessBasis)} ${escape(review.attributionNote)}</p>
    <p><strong>Coverage assessment:</strong> ${escape(review.assessment)} <sup><a href="./index.html#ref-${review.sourceId}">[${review.sourceId}]</a></sup></p>
    <p><a href="./conference-notes-review.json" download>Download the supplied-excerpt review</a></p>
    ${review.directions.map(item => `<article class="notes-item" id="note-${item.id}">
      <h3>${escape(item.id.replaceAll('-', ' '))}</h3>
      <p class="workshop-caption">Attribution in the supplied note: ${escape(item.attributionAsProvided)}.</p>
      <p><strong>Source cue (abridged):</strong> ${escape(item.sourceWording)}</p>
      <p><strong>Editorial response:</strong> ${escape(item.response)}</p>
      <p>${sectionLinks(workshop, item.sectionTitles, false)}</p></article>`).join('')}`;
}

export function conferencePresentationSection(review) {
  return {
    id: 'source-conference-note-review',
    title: 'Conference-note excerpt: coverage and additions',
    url: './workshop.html#conference-notes',
    paragraphs: [
      review.accessBasis,
      review.assessment,
      ...review.directions.map(item => `${item.attributionAsProvided}. Source cue (abridged): ${item.sourceWording} Editorial response: ${item.response}`),
    ],
  };
}

export function renderNodeMechanisms(data) {
  const expected = ['protocols', 'browser-agent', 'domain-app', 'cdn', 'identity-consent',
    'database-server', 'model-compute', 'provenance-validation', 'settlement', 'community-energy'];
  if (data.schemaVersion !== 1 || data.sourceId !== 'S99'
    || JSON.stringify(data.nodes.map(node => node.id)) !== JSON.stringify(expected)) {
    throw new Error('Mechanism matrix must cover the ten declared request nodes');
  }
  for (const node of data.nodes) {
    for (const key of ['title', 'market', 'policy', 'nonMarket', 'philanthropic']) {
      if (typeof node[key] !== 'string' || !node[key].trim()) throw new Error(`Mechanism node ${node.id} missing ${key}`);
    }
  }
  return `<section id="intervention-modes" aria-labelledby="intervention-heading">
    <h2 id="intervention-heading">Which kind of intervention tips each node?</h2>
    <p>${escape(data.note)} <sup><a href="./index.html#ref-S99">[S99]</a></sup></p>
    <div class="table-wrap mechanism-table" tabindex="0" role="region" aria-label="Ten nodes and four intervention modes">
      <table><thead><tr><th scope="col">Node</th><th scope="col">Market mechanism</th><th scope="col">Policy / legal instrument</th><th scope="col">Non-market coordination</th><th scope="col">Philanthropic capacity</th></tr></thead><tbody>
      ${data.nodes.map(node => `<tr><th scope="row"><a href="#tip-${node.id}">${escape(node.title)}</a></th>
        <td>${escape(node.market)}</td><td>${escape(node.policy)}</td><td>${escape(node.nonMarket)}</td><td>${escape(node.philanthropic)}</td></tr>`).join('')}
      </tbody></table></div>
    <p>For every proposed mechanism, identify the actor, authority, beneficiary, evidence, funding duration, and exit path. A subsidy is not proof of demand; a voluntary coalition is not a public regulator; and a charitable contribution is not permission to impose unrelated harms.</p>
    <p><a href="./node-mechanisms.json" download>Download the mechanism matrix</a> · <a href="./workshop.html#conference-notes">Read the supplied-note coverage review</a></p>
  </section>`;
}
