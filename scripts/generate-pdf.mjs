import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const output = path.join(dist, 'commons-collective.pdf');
const stylesheet = path.join(root, 'site', 'pdf.css');
const contentTypes = {
  '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript',
  '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.ico': 'image/x-icon',
};

function executablePath() {
  if (process.env.PDF_BROWSER_PATH) {
    if (!existsSync(process.env.PDF_BROWSER_PATH)) {
      throw new Error(`PDF_BROWSER_PATH does not exist: ${process.env.PDF_BROWSER_PATH}`);
    }
    return process.env.PDF_BROWSER_PATH;
  }
  const candidates = [
    chromium.executablePath(),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  const browser = candidates.find(candidate => candidate && existsSync(candidate));
  if (!browser) {
    throw new Error('No Chromium browser found. Run npx playwright install chromium, or set PDF_BROWSER_PATH.');
  }
  return browser;
}

try {
  await readFile(path.join(dist, 'index.html'));
} catch (error) {
  if (error.code === 'ENOENT') throw new Error('Build the site first with npm run build.', { cause: error });
  throw error;
}
const css = await readFile(stylesheet, 'utf8');
// This short-lived server serves only the built site, binds only loopback, and closes in finally.
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(dist, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] ?? 'application/octet-stream' });
    response.end(data);
  } catch (error) {
    if (error instanceof URIError) response.writeHead(400).end('Malformed path');
    else if (error.code === 'ENOENT' || error.code === 'EISDIR') response.writeHead(404).end();
    else {
      console.error('PDF preview resource failure:', error);
      response.writeHead(500).end('Resource could not be read');
    }
  }
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`PDF preview: ${origin} (closed when export finishes)`);
  browser = await chromium.launch({ executablePath: executablePath(), headless: true });
  if (Number(browser.version().split('.')[0]) < 131) {
    throw new Error('Chromium 131 or newer is required for CSS page counters and margin boxes.');
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const failedResources = [];
  page.on('requestfailed', request => failedResources.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) failedResources.push(`${response.url()}: HTTP ${response.status()}`);
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(`${origin}/`) || url.startsWith('data:')
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  // Inject the same stylesheet even when a caller has not wired the browser-print link yet.
  await page.addStyleTag({ content: css });
  const manifest = await page.evaluate(async () => {
    const report = document.querySelector('article#report');
    if (!report || !report.querySelector('#abstract')) throw new Error('The main report and Abstract are required.');
    for (const details of document.querySelectorAll('#report details, #references details')) details.open = true;
    for (const source of document.querySelectorAll('#references li[hidden]')) source.hidden = false;
    for (const image of document.images) image.loading = 'eager';
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    const canonical = new URL(document.querySelector('link[rel="canonical"]')?.href ?? '');
    if (canonical.protocol !== 'https:') throw new Error('PDF links need the canonical HTTPS publication URL.');
    let rewrittenProjectLinks = 0;
    for (const anchor of document.querySelectorAll('a[href]')) {
      if (anchor.getAttribute('href').startsWith('#')) continue;
      const target = new URL(anchor.href);
      if (target.origin === location.origin) {
        anchor.href = new URL(target.pathname.slice(1) + target.search + target.hash, canonical).href;
        rewrittenProjectLinks += 1;
      }
    }
    const headings = [...report.querySelectorAll(':scope > h2')].map(node => ({
      id: node.id, text: node.textContent.trim(),
    }));
    const images = [...document.images].filter(image => image.getClientRects().length).map(image => ({
      src: new URL(image.currentSrc).pathname, width: image.naturalWidth, height: image.naturalHeight,
    }));
    const text = [...document.querySelectorAll('#report p, #report li, #report td, #report th, #report h3, #report h4, #report figcaption, #report summary, #references p, #references .source-id, body > footer p')]
      .filter(node => node.getClientRects().length && !node.querySelector('p, li, td, th'))
      .map(node => node.innerText.trim()).filter(Boolean);
    return {
      headings, images, text, canonicalUrl: canonical.href, rewrittenProjectLinks,
      sourceIds: [...document.querySelectorAll('#references > ol > li')].map(node => node.id),
    };
  });
  if (failedResources.length) throw new Error(`Failed resources:\n${failedResources.join('\n')}`);
  if (manifest.headings[0]?.id !== 'abstract') throw new Error('Abstract must be the first report heading.');
  if (manifest.images.some(image => !image.width || !image.height)) throw new Error('An image did not load.');
  await page.pdf({
    path: output,
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    tagged: true,
    outline: true,
  });
  await writeFile(`${output}.checks.json`, `${JSON.stringify({
    browser: browser.version(), ...manifest,
  }, null, 2)}\n`);
  console.log(`Generated ${path.relative(root, output)}; ${manifest.headings.length} headings, ${manifest.images.length} loaded images.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
