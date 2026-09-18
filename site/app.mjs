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
