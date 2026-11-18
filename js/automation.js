// تبويب الأتمتة: حالة السيرفر + QR + الإعدادات + طابور الرسائل
const Automation = {
  id: 'automation', title: 'الأتمتة', icon: '🤖', st: {}, lastQR: null,
  html: `
    <div class="card"><h3>📡 حالة واتساب</h3><div id="waState"></div><div id="waQR" style="display:flex;justify-content:center;margin:12px 0"></div></div>
    <div class="card"><h3>⚙️ الإعدادات</h3>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="wEnabled" style="width:auto"> تشغيل الإرسال التلقائي</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="wExam" style="width:auto"> تقرير الامتحان تلقائياً بعد موعد الغلق (+5 دقايق)</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="wWeekly" style="width:auto"> التقرير العام الأسبوعي</label>
      <div class="grid"><div><label>يوم التقرير الأسبوعي</label><select id="wDay"><option value="6">السبت</option><option value="0">الأحد</option><option value="1">الاثنين</option><option value="2">الثلاثاء</option><option value="3">الأربعاء</option><option value="4">الخميس</option><option value="5">الجمعة</option></select></div>
        <div><label>من الساعة (0-23)</label><input type="number" id="wHour" min="0" max="23"></div></div>
      <div class="grid"><div><label>أقل فاصل بين الرسايل (ثانية)</label><input type="number" id="wMin" min="3"></div>
        <div><label>أقصى فاصل (ثانية)</label><input type="number" id="wMax" min="5"></div>
        <div><label>الحد اليومي للرسايل</label><input type="number" id="wCap" min="1"></div></div>
      <button class="btn ok full" onclick="Automation.save()">حفظ الإعدادات</button></div>
    <div class="card"><h3>📬 طابور الرسائل</h3>
      <div class="row" style="margin-bottom:8px"><button class="btn sm warn" onclick="Automation.retry()">🔁 إعادة المحاولة للفاشل</button>
        <button class="btn sm bad" onclick="Automation.clear()">🧹 مسح المرسل والفاشل</button></div><div id="waQueue"></div></div>`,

  init() {
    db.ref('waStatus').on('value', (s) => { this.st = s.val() || {}; this.renderState(); });
    db.ref('waSettings').on('value', (s) => {
      const v = { enabled: false, autoExam: true, autoWeekly: false, weeklyDay: 5, weeklyHour: 18, minDelay: 8, maxDelay: 20, dailyCap: 150, ...(s.val() || {}) };
      $('wEnabled').checked = !!v.enabled; $('wExam').checked = !!v.autoExam; $('wWeekly').checked = !!v.autoWeekly;
      $('wDay').value = v.weeklyDay; $('wHour').value = v.weeklyHour; $('wMin').value = v.minDelay; $('wMax').value = v.maxDelay; $('wCap').value = v.dailyCap;
    });
    db.ref('waQueue').orderByChild('createdAt').limitToLast(40).on('value', (s) => this.renderQueue(s.val() || {}));
    setInterval(() => this.renderState(), 30000);
  },
  renderState() {
    const s = this.st, online = s.heartbeat && Date.now() - s.heartbeat < 180000;
    const label = { connected: '✅ متصل', qr: '📱 في انتظار مسح الـ QR', reconnecting: '🔄 بيعيد الاتصال', loggedout: '⚠️ تم تسجيل الخروج — امسح QR جديد', starting: '⏳ بيبدأ' }[s.state] || 'غير معروف';
    $('waState').innerHTML = `<div class="item"><span>السيرفر: <b style="color:${online ? 'var(--ok)' : 'var(--bad)'}">${online ? 'شغال' : 'مش شغال'}</b></span>
      <span>واتساب: <b>${online ? label : '—'}</b></span></div>${s.note ? `<div class="msg error">${esc(s.note)}</div>` : ''}`;
    const box = $('waQR');
    if (online && s.state === 'qr' && s.qr) {
      if (this.lastQR !== s.qr) { this.lastQR = s.qr; box.innerHTML = ''; new QRCode(box, { text: s.qr, width: 240, height: 240 }); }
    } else { this.lastQR = null; box.innerHTML = ''; }
  },
  renderQueue(q) {
    const ids = Object.keys(q).sort((a, b) => q[b].createdAt - q[a].createdAt);
    const col = { pending: 'var(--warn)', sending: 'var(--main)', sent: 'var(--ok)', failed: 'var(--bad)' }, txt = { pending: '⏳ منتظر', sending: '📤 بيتبعت', sent: '✅ اتبعت', failed: '❌ فشل' };
    $('waQueue').innerHTML = ids.map(k => { const x = q[k];
      return `<div class="item" style="border-right-color:${col[x.status]}"><div><strong>${esc(x.name || x.phone)}</strong>
        <div class="meta">${esc(x.type || 'يدوي')} • ${new Date(x.createdAt).toLocaleString('ar-EG')}${x.error ? ' • ' + esc(x.error) : ''}</div></div><span>${txt[x.status] || x.status}</span></div>`; }).join('') || '<p class="empty">الطابور فاضي</p>';
  },
  async save() {
    await db.ref('waSettings').set({ enabled: $('wEnabled').checked, autoExam: $('wExam').checked, autoWeekly: $('wWeekly').checked,
      weeklyDay: +$('wDay').value, weeklyHour: +$('wHour').value || 0, minDelay: +$('wMin').value || 8, maxDelay: +$('wMax').value || 20, dailyCap: +$('wCap').value || 150 });
    toast('✅ تم حفظ الإعدادات');
  },
  async retry() {
    const q = (await db.ref('waQueue').orderByChild('status').equalTo('failed').once('value')).val() || {}, up = {};
    Object.keys(q).forEach(k => up[`waQueue/${k}/status`] = 'pending'); await db.ref().update(up); toast(`🔁 ${Object.keys(up).length} رسالة اتعادت`);
  },
  async clear() {
    if (!confirm('مسح كل الرسايل المرسلة والفاشلة من الطابور؟')) return;
    const q = (await db.ref('waQueue').once('value')).val() || {}, up = {};
    Object.keys(q).forEach(k => { if (['sent', 'failed'].includes(q[k].status)) up[`waQueue/${k}`] = null; }); await db.ref().update(up);
  }
};
App.register(Automation);
