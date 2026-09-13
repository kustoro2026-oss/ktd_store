// Universal draft-fix function text for browser evaluate_script.
// Build: node -e "console.log(require('./scripts/lazada-draftfix-fn.js'))" > tiktok-upload/draftfix-fn.txt
const fs = require('fs');
const volmap = JSON.parse(fs.readFileSync('tiktok-upload/lazada-volmap.json', 'utf8'));

const fn = `async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [];
  const ep = Event.prototype;
  if (!ep.__patchedBUL) {
    const orig = ep.preventDefault;
    ep.preventDefault = function() { if (this.type === 'beforeunload') return; return orig.apply(this, arguments); };
    ep.__patchedBUL = true;
  }
  const VOLMAP = ${JSON.stringify(volmap)};
  const skuInput = [...document.querySelectorAll('input')].find(i => i.value && i.value.startsWith('KTDCGK-'));
  const pid = skuInput ? skuInput.value.replace('KTDCGK-', '') : null;
  out.push('pid:' + pid);

  // 1) warranty type
  const wErr = document.querySelector('.form-field-warrantyType.next-formily-item-error, .form-field-warrantyType .next-formily-item-error-help');
  if (wErr) {
    const trig = document.querySelector('.form-field-warrantyType .next-select-trigger');
    if (trig) {
      trig.click();
      await sleep(700);
      const opt = [...document.querySelectorAll('.next-select-menu .next-menu-item')].find(el => el.textContent.trim() === 'Tidak Ada Garansi');
      if (opt) { opt.click(); await sleep(500); out.push('warranty:set'); } else out.push('warranty:opt-missing');
    } else out.push('warranty:trigger-missing');
  }

  // 2) variant (customSaleProp) fill from map
  const vErr = document.querySelector('.form-field-customSaleProp .next-formily-item-error, .form-field-customSaleProp .next-formily-item-error-help');
  const v = pid ? VOLMAP[pid] : null;
  if (vErr) {
    const numInput = document.querySelector('.form-field-customSaleProp .prop-option-list input[aria-valuemax], .form-field-customSaleProp .prop-option-list input');
    if (numInput && v) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(numInput, String(v[0]));
      numInput.dispatchEvent(new Event('input', { bubbles: true }));
      numInput.dispatchEvent(new Event('change', { bubbles: true }));
      out.push('variant:val ' + v[0]);
      await sleep(400);
      const unitTrg = document.querySelector('.form-field-customSaleProp .next-select-trigger');
      if (unitTrg) {
        unitTrg.click();
        await sleep(600);
        const unitOpt = [...document.querySelectorAll('.next-select-menu .next-menu-item')].find(el => el.textContent.trim().toLowerCase() === String(v[1]).toLowerCase());
        if (unitOpt) { unitOpt.click(); out.push('variant:unit ' + v[1]); } else out.push('variant:unit-missing ' + v[1]);
      } else out.push('variant:unit-trigger-missing');
    } else {
      out.push('variant:err but no numInput' + (v ? '' : ' and NO MAP'));
    }
  }

  // 3) package type (Jenis paket) -> Tunggal
  const pLb = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Jenis paket');
  const pField = pLb ? pLb.closest('.next-formily-item') : null;
  const pErr = pField && pField.classList.contains('next-formily-item-error');
  if (pErr) {
    const trg = pField.querySelector('.next-select-trigger');
    if (trg) {
      trg.click();
      await sleep(900);
      const opt = [...document.querySelectorAll('.next-select-menu .next-menu-item')].find(el => el.textContent.trim() === 'Tunggal');
      if (opt) { opt.click(); out.push('pkg:Tunggal'); await sleep(700); } else out.push('pkg:opt-missing');
    } else out.push('pkg:trigger-missing');
  }

  // 4) submit
  await sleep(300);
  const kirim = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Kirim');
  if (kirim) { kirim.click(); out.push('kirim:clicked'); } else out.push('kirim:NOTFOUND');
  return JSON.stringify(out);
}`;

module.exports = fn;
if (require.main === module) console.log(fn);
