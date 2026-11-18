const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GRADES = { '5': 'الثاني الإعدادي', '1': 'الأول الثانوي', '2': 'الثاني الثانوي', '3': 'الثالث الثانوي' };
const gradeOptions = (withAll) => (withAll ? '<option value="all">كل الصفوف</option>' : '') +
  Object.entries(GRADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const read = async (path) => (await db.ref(path).once('value')).val() || {};
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 3500);
}
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const toCSV = (rows) => '\ufeff' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
const toMs = (v) => v ? new Date(v).getTime() : 0;

async function uploadImage(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = bmp.width * k; c.height = bmp.height * k;
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .75));
  const fd = new FormData(); fd.append('image', blob); fd.append('key', CFG.IMGBB_KEY);
  const d = await (await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd })).json();
  if (!d.success) throw new Error(d.error?.message || 'فشل رفع الصورة');
  return d.data.url;
}

function toggleDark() {
  const on = document.body.classList.toggle('dark');
  try { localStorage.setItem('adminDark', on ? '1' : '0'); } catch (_) {}
}
try { if (localStorage.getItem('adminDark') === '1') document.body.classList.add('dark'); } catch (_) {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function modal(html) {
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9998;display:flex;justify-content:center;align-items:center;padding:20px';
  m.innerHTML = `<div class="card" style="max-width:720px;width:100%;max-height:90vh;overflow:auto;margin:0"><button class="btn sm bad" onclick="this.parentElement.parentElement.remove()">إغلاق ✕</button>${html}</div>`;
  document.body.appendChild(m);
}
