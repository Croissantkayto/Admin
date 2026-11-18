const Announcements = {
  id: 'announcements', title: 'الإعلانات', icon: '📢', data: {},
  html: `<div class="card"><h3>📢 إرسال إعلان للطلاب</h3>
      <input id="aTitle" placeholder="عنوان الإعلان"><textarea id="aBody" rows="3" placeholder="نص الإعلان (اختياري)"></textarea>
      <select id="aGrade"><option value="">كل الصفوف</option>${gradeOptions()}</select>
      <button class="btn ok full" onclick="Announcements.send()">إرسال</button></div>
    <div class="card"><h3>📋 الإعلانات السابقة</h3><div id="aList"></div></div>`,
  init() { db.ref('announcements').on('value', (s) => { this.data = s.val() || {}; this.render(); }); },
  render() {
    const ids = Object.keys(this.data).sort((a, b) => (this.data[b].timestamp || 0) - (this.data[a].timestamp || 0));
    $('aList').innerHTML = ids.map(id => { const a = this.data[id];
      return `<div class="item"><div><strong>${esc(a.title)}</strong><div>${esc(a.body || '')}</div>
        <div class="meta">${GRADES[a.grade] || 'كل الصفوف'} • ${new Date(a.timestamp || 0).toLocaleString('ar-EG')}</div></div>
        <button class="btn sm bad" onclick="Announcements.remove('${id}')"><i class="fas fa-trash"></i></button></div>`; }).join('') || '<p class="empty">لا توجد إعلانات</p>';
  },
  async send() {
    const title = $('aTitle').value.trim(); if (!title) return toast('⚠️ أدخل عنوان الإعلان', true);
    await db.ref('announcements').push({ title, body: $('aBody').value.trim(), grade: $('aGrade').value, timestamp: Date.now() });
    $('aTitle').value = ''; $('aBody').value = ''; toast('✅ تم الإرسال');
  },
  async remove(id) { if (confirm('حذف الإعلان؟')) await db.ref('announcements/' + id).remove(); }
};
App.register(Announcements);
