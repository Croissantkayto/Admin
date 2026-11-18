// نواة التطبيق: كل تبويب بيتسجل بـ App.register({id,title,icon,html,init,onOpen})
const App = {
  tabs: [], mounted: false,
  register(t) { this.tabs.push(t); },
  mount() {
    if (this.mounted) return; this.mounted = true;
    $('nav').innerHTML = this.tabs.map(t => `<button class="nav-tab" data-tab="${t.id}">${t.icon} ${t.title}</button>`).join('');
    $('pages').innerHTML = this.tabs.map(t => `<section class="page" id="tab-${t.id}">${t.html}</section>`).join('');
    $('nav').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) this.open(b.dataset.tab); };
    this.tabs.forEach(t => t.init && t.init());
    this.open(this.tabs[0].id);
  },
  open(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    const t = this.tabs.find(x => x.id === id); if (t && t.onOpen) t.onOpen();
  }
};
