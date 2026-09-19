import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const sourceText = await readFile(new URL('../research/workshop-statements.json', import.meta.url), 'utf8');
const workshop = JSON.parse(sourceText);
const assets = new URL('../site/assets/workshop/', import.meta.url);
const expectedIds = ['brief', 'zoe-cullen', 'tillemann', 'erika-yorio', 'nicholas-vincent', 'beth-goldberg', 'jaron-lanier'];

function pngChunks(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= bytes.length, 'PNG chunk is within the file');
    chunks.push(bytes.toString('ascii', offset + 4, offset + 8));
    offset += length + 12;
  }
  assert.equal(offset, bytes.length);
  assert.equal(chunks.at(-1), 'IEND');
  return chunks;
}

test('workshop source identifies the supplied photograph without publishing local attachment details', () => {
  assert.equal(workshop.schemaVersion, 1);
  assert.equal(workshop.source.contextDate, '2026-09-18');
  assert.equal(workshop.source.dateBasis, 'Context supplied by user; not independently inferred from image metadata');
  assert.equal(workshop.source.imageUrl, './assets/workshop/original.png');
  assert.equal(workshop.source.width, 1024);
  assert.equal(workshop.source.height, 768);
  assert.equal(workshop.source.originalSha256, 'b44b353fb12b15610609b1ac22a0fcd63c2ee4c82a2e82bb262647485594954f');
  assert.match(workshop.source.rightsNote, /rights holders/);
  assert.match(workshop.source.rightsNote, /No photographer attribution or Creative Commons license/);
  assert.match(workshop.source.transcriptionNote, /not verified spoken quotations or evidence of endorsement/);
  assert.doesNotMatch(sourceText, /[A-Za-z]:\\|AppData|agentSessionData|session-state|Pasted Image/i);
});

test('one group brief and all six attributed statement cards have complete transcription records', () => {
  assert.deepEqual(workshop.cards.map(card => card.id), expectedIds);
  assert.equal(workshop.cards.filter(card => card.kind === 'brief').length, 1);
  assert.equal(workshop.cards.filter(card => card.kind === 'individual').length, 6);
  assert.equal(workshop.cards[0].attributionAsPrinted, 'No individual attribution printed');
  for (const card of workshop.cards) {
    assert.ok(card.title && card.attributionAsPrinted && card.transcription);
    assert.ok(card.affiliationAsPrinted === null || typeof card.affiliationAsPrinted === 'string');
    assert.ok(Array.isArray(card.uncertainties));
    assert.ok(card.uncertainties.every(note => typeof note === 'string' && note.trim()));
    const hasUnclear = /\[unclear\]/.test(`${card.title} ${card.attributionAsPrinted} ${card.affiliationAsPrinted ?? ''} ${card.transcription}`);
    if (hasUnclear) assert.ok(card.uncertainties.length, `${card.id} must explain unclear readings`);
    assert.equal(card.cropUrl, `./assets/workshop/${card.id}.png`);
  }
  const byId = Object.fromEntries(workshop.cards.map(card => [card.id, card]));
  assert.equal(byId.tillemann.attributionAsPrinted, 'Tomicah Tillemann (Project Liberty).');
  assert.equal(byId['nicholas-vincent'].affiliationAsPrinted, null);
  assert.equal((byId.brief.transcription.match(/\?/g) ?? []).length, 6);
  assert.match(byId.brief.transcription, /\(individual workers, users of platforms, small publishers\)/);
  assert.match(byId.brief.transcription, /\(who do represent data creators\)/);
  assert.match(byId.brief.transcription, /public awareness, policy, entrepreneurship, etc\.\?$/);
  assert.match(byId['nicholas-vincent'].transcription, /\(i\).*\(ii\).*\(iii\)/);
  assert.match(byId['jaron-lanier'].transcription, /MIDs \(mediator intermediaries\)/);
  assert.match(byId['jaron-lanier'].transcription, /Autonomy/);
});

test('published PNGs contain only image-rendering chunks and exactly one crop per card', async () => {
  const names = (await readdir(assets)).sort();
  assert.deepEqual(names, ['original.png', ...expectedIds.map(id => `${id}.png`)].sort());
  const renderingChunks = new Set(['IHDR', 'IDAT', 'IEND', 'gAMA', 'sRGB', 'cHRM', 'pHYs']);
  for (const name of names) {
    const chunks = pngChunks(await readFile(new URL(name, assets)));
    assert.ok(chunks.every(chunk => renderingChunks.has(chunk)), `${name} contains non-rendering metadata`);
  }
});

test('all original-resolution crops are in bounds and pixel-identical to the full-frame image', async () => {
  const original = PNG.sync.read(await readFile(new URL('original.png', assets)));
  assert.equal(original.width, workshop.source.width);
  assert.equal(original.height, workshop.source.height);
  for (const card of workshop.cards) {
    const { x, y, width, height } = card.crop;
    assert.ok([x, y, width, height].every(Number.isInteger), card.id);
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, card.id);
    assert.ok(x + width <= original.width && y + height <= original.height, card.id);
    const cropped = PNG.sync.read(await readFile(new URL(`${card.id}.png`, assets)));
    assert.equal(cropped.width, width, card.id);
    assert.equal(cropped.height, height, card.id);
    for (let row = 0; row < height; row++) {
      const start = ((y + row) * original.width + x) * 4;
      assert.deepEqual(
        cropped.data.subarray(row * width * 4, (row + 1) * width * 4),
        original.data.subarray(start, start + width * 4),
        `${card.id}: pixel row ${row}`
      );
    }
  }
});
