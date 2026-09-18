import { settle } from './model.mjs';

const form = document.querySelector('#calculator');
const error = document.querySelector('#calculator-error');
const output = document.querySelector('#calculator-output');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const format = cents => money.format(cents / 100);

function update(event) {
  event?.preventDefault();
  if (!form.reportValidity()) return;
  const dollars = Number(form.elements.revenue.value);
  const members = Number(form.elements.members.value);
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(members)) {
    error.textContent = 'Enter whole dollars and a whole number of eligible members.';
    output.hidden = true;
    return;
  }
  const result = settle(dollars * 100, members);
  error.textContent = '';
  output.hidden = false;
  for (const name of ['members', 'commons', 'operations', 'reserve', 'perMember', 'memberLiability']) {
    document.querySelector(`[data-result="${name}"]`).textContent = format(result[name]);
  }
}

form.addEventListener('submit', update);
update();

document.querySelector('#print').addEventListener('click', () => window.print());

const search = document.querySelector('#source-search');
const sourceItems = [...document.querySelectorAll('#references li')];
search.addEventListener('input', () => {
  const term = search.value.trim().toLocaleLowerCase();
  for (const item of sourceItems) item.hidden = !item.textContent.toLocaleLowerCase().includes(term);
  document.querySelector('#source-count').textContent =
    `${sourceItems.filter(item => !item.hidden).length} of ${sourceItems.length} sources shown`;
});

// A filtered bibliography must not hide the target of an in-text citation.
document.querySelector('#report').addEventListener('click', event => {
  const link = event.target.closest('a[href^="#ref-"]');
  if (link) {
    search.value = '';
    search.dispatchEvent(new Event('input'));
  }
});

const header = document.querySelector('.site-header');
const navigation = [...header.querySelectorAll('[data-nav]')];
const sections = [
  { name: 'overview', element: document.querySelector('#overview') },
  { name: 'research', element: document.querySelector('#report') },
  { name: 'demos', element: document.querySelector('#lab') },
  { name: 'research', element: document.querySelector('#references') },
];
let navigationFramePending = false;

function updateNavigation() {
  navigationFramePending = false;
  const height = header.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-height', `${height}px`);
  let current = 'overview';
  for (const section of sections) {
    if (section.element.getBoundingClientRect().top <= height + 40) current = section.name;
  }
  for (const link of navigation) {
    if (link.dataset.nav === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

function scheduleNavigationUpdate() {
  if (navigationFramePending) return;
  navigationFramePending = true;
  requestAnimationFrame(updateNavigation);
}

window.addEventListener('scroll', scheduleNavigationUpdate, { passive: true });
new ResizeObserver(scheduleNavigationUpdate).observe(header);
updateNavigation();
