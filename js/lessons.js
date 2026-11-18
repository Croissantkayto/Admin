// تبويب الدروس: إضافة / نشر / حذف + إدارة المحتوى والامتحانات
const Lessons = {
  id: 'lessons', title: 'الدروس', icon: '📖', data: {}, filter: 'all',
  html: `
    <div class="card"><h3>➕ إضافة درس</h3>
      <input id="lName" placeholder="اسم الدرس"><input id="lDesc" placeholder="وصف (اختياري)">
      <select id="lGrade">${gradeOptions()}</select>
      <button class="btn ok full" onclick="Lessons.add()">إضافة الدرس</button></div>
    <div class="card"><h3>📋 الدروس</h3>
      <div class="row" style="margin-bottom:10px">
        <select id="lFilter" style="width:auto" onchange="Lessons.filter=this.value;Lessons.render()">${gradeOptions(true)}</select>
        <button class="btn sm warn" onclick="Lessons.publishAll(true)">نشر الكل</button>
        <button class="btn sm bad" onclick="Lessons.publishAll(false)">إخفاء الكل</button></div>
      <div id="lessonsList"></div></div>
    <div class="card"><h3>⚙️ إدارة محتوى الدرس</h3>
      <select id="manageLesson" class="lesson-select" onchange="Lessons.renderManage()"></select>
      <div id="manageArea"></div></div>`,

  init() {
    db.ref('lessons').on('value', (s) => { this.data = s.val() || {}; this.render(); this.fillSelects(); this.renderManage(); });
  },
  ids() { return Object.keys(this.data); },
  fillSelects() {
    const opts = '<option value="">اختر الدرس...</option>' + this.ids().map(i => `<option value="${i}">${esc(this.data[i].name)}</option>`).join('');
    document.querySelectorAll('select.lesson-select').forEach(s => { const v = s.value; s.innerHTML = opts; s.value = v; });
  },
  examOptions(lessonId) {
    const ex = (this.data[lessonId] || {}).exams || [];
    return '<option value="">اختر الامتحان...</option>' + ex.map((e, i) => `<option value="${i}">${esc(e.name)}</option>`).join('');
  },
  render() {
    const rows = this.ids().filter(i => this.filter === 'all' || this.data[i].grade === this.filter).map(i => {
      const l = this.data[i];
      return `<div class="item"><div><strong>📖 ${esc(l.name)}</strong>
        <div class="meta">${GRADES[l.grade] || ''} • ${(l.exams || []).length} امتحان • ${(l.contents || []).length} محتوى
        <span class="badge ${l.isPublished ? 'on' : 'off'}">${l.isPublished ? 'منشور' : 'غير منشور'}</span></div></div>
        <div class="row"><button class="btn sm warn" onclick="Lessons.toggle('${i}')">${l.isPublished ? 'إخفاء' : 'نشر'}</button>
        <button class="btn sm bad" onclick="Lessons.remove('${i}')"><i class="fas fa-trash"></i></button></div></div>`;
    });
    $('lessonsList').innerHTML = rows.join('') || '<p class="empty">لا توجد دروس</p>';
  },
  async add() {
    const name = $('lName').value.trim();
    if (!name) return toast('⚠️ أدخل اسم الدرس', true);
    await db.ref('lessons').push({ name, description: $('lDesc').value.trim() || 'لا يوجد وصف', grade: $('lGrade').value, contents: [], exams: [], isPublished: false, createdAt: Date.now() });
    $('lName').value = ''; $('lDesc').value = ''; toast('✅ تمت الإضافة');
  },
  toggle(id) { return db.ref(`lessons/${id}/isPublished`).set(!this.data[id].isPublished); },
  async publishAll(flag) {
    if (!confirm(flag ? 'نشر كل الدروس؟' : 'إخفاء كل الدروس؟')) return;
    const up = {}; this.ids().forEach(i => up[`lessons/${i}/isPublished`] = flag);
    await db.ref().update(up); toast('✅ تم');
  },
  async remove(id) {
    if (!confirm('حذف الدرس وكل أسئلته؟')) return;
    const qs = (await db.ref('questions').orderByChild('lessonId').equalTo(id).once('value')).val() || {};
    const up = { ['lessons/' + id]: null }; Object.keys(qs).forEach(q => up['questions/' + q] = null);
    await db.ref().update(up); toast('✅ تم الحذف');
  },

  // ---- المحتوى والامتحانات ----
  renderManage() {
    const id = $('manageLesson').value, box = $('manageArea'), l = this.data[id];
    if (!l) { box.innerHTML = '<p class="empty">اختر درساً لإدارته</p>'; return; }
    const icon = { pdf: '📄', image: '🖼️', video: '🎬', link: '🔗' };
    const contents = (l.contents || []).map((c, i) => `<div class="item"><span>${icon[c.type] || '🔗'} ${esc(c.title)}</span>
      <button class="btn sm bad" onclick="Lessons.delContent('${id}',${i})"><i class="fas fa-trash"></i></button></div>`).join('') || '<p class="empty">لا يوجد محتوى</p>';
    const exams = (l.exams || []).map((e, i) => `<div class="item"><div><strong>${esc(e.name)}</strong>
      <div class="meta">⏱ ${e.timeLimit}د • ${e.questionCount === 'all' ? 'كل الأسئلة' : e.questionCount + ' سؤال'}${e.maxAttempts ? ' • ' + e.maxAttempts + ' محاولات' : ''}${e.openAt ? ' • يفتح ' + new Date(e.openAt).toLocaleString('ar-EG') : ''}${e.closeAt ? ' • يغلق ' + new Date(e.closeAt).toLocaleString('ar-EG') : ''}</div></div>
      <button class="btn sm bad" onclick="Lessons.delExam('${id}',${i})"><i class="fas fa-trash"></i></button></div>`).join('') || '<p class="empty">لا توجد امتحانات</p>';
    box.innerHTML = `
      <h4>📎 المحتوى</h4>${contents}
      <div class="grid"><select id="cType"><option value="pdf">📄 PDF</option><option value="image">🖼️ صورة</option><option value="video">🎬 فيديو</option><option value="link">🔗 رابط</option></select>
        <input id="cTitle" placeholder="العنوان"></div>
      <input id="cUrl" placeholder="الرابط"><button class="btn sm ok" onclick="Lessons.addContent('${id}')">إضافة محتوى</button>
      <h4 style="margin-top:18px">📝 الامتحانات</h4>${exams}
      <input id="eName" placeholder="اسم الامتحان">
      <div class="grid"><div><label>عدد الأسئلة (0 = الكل)</label><input type="number" id="eCount" value="10" min="0"></div>
        <div><label>المدة (دقيقة)</label><input type="number" id="eTime" value="20" min="1"></div>
        <div><label>المحاولات (0 = بلا حد)</label><input type="number" id="eTries" value="0" min="0"></div></div>
      <div class="grid"><div><label>موعد الفتح</label><input type="datetime-local" id="eOpen"></div>
        <div><label>موعد الغلق</label><input type="datetime-local" id="eClose"></div></div>
      <button class="btn sm ok" onclick="Lessons.addExam('${id}')">إضافة امتحان</button>`;
  },
  async addContent(id) {
    const url = $('cUrl').value.trim(); if (!url) return toast('⚠️ أدخل الرابط', true);
    const arr = [...(this.data[id].contents || []), { id: Date.now(), type: $('cType').value, title: $('cTitle').value.trim() || $('cType').value, url, createdAt: Date.now() }];
    await db.ref(`lessons/${id}/contents`).set(arr);
  },
  async delContent(id, i) {
    if (!confirm('حذف المحتوى؟')) return;
    const arr = [...(this.data[id].contents || [])]; arr.splice(i, 1);
    await db.ref(`lessons/${id}/contents`).set(arr);
  },
  async addExam(id) {
    const name = $('eName').value.trim(), time = parseInt($('eTime').value), n = parseInt($('eCount').value) || 0;
    const openAt = toMs($('eOpen').value), closeAt = toMs($('eClose').value);
    if (!name) return toast('⚠️ أدخل اسم الامتحان', true);
    if (!(time >= 1)) return toast('⚠️ أدخل مدة صحيحة', true);
    if (openAt && closeAt && closeAt <= openAt) return toast('⚠️ الغلق لازم يكون بعد الفتح', true);
    const arr = [...(this.data[id].exams || []), { id: Date.now(), name, questionCount: n === 0 ? 'all' : n, timeLimit: time, openAt, closeAt, maxAttempts: parseInt($('eTries').value) || 0, createdAt: Date.now() }];
    await db.ref(`lessons/${id}/exams`).set(arr); toast('✅ تمت إضافة الامتحان');
  },
  async delExam(id, index) {   // يحذف أسئلة الامتحان ويصحح ترقيم اللي بعده
    if (!confirm('حذف الامتحان وكل أسئلته؟')) return;
    const exams = [...(this.data[id].exams || [])]; exams.splice(index, 1);
    const qs = (await db.ref('questions').orderByChild('lessonId').equalTo(id).once('value')).val() || {};
    const up = { [`lessons/${id}/exams`]: exams };
    Object.keys(qs).forEach(q => { const i = +qs[q].examIndex; if (i === index) up['questions/' + q] = null; else if (i > index) up[`questions/${q}/examIndex`] = i - 1; });
    await db.ref().update(up); toast('✅ تم الحذف');
  }
};
App.register(Lessons);
