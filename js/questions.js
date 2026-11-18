// تبويب الأسئلة: نموذج واحد بأنواع (اختياري / صورة / صح-خطأ / مقالي / ملف)
const Questions = {
  id: 'questions', title: 'الأسئلة', icon: '❓', type: 'mcq',
  html: `
    <div class="card"><h3>➕ إضافة سؤال</h3>
      <div class="grid"><select id="qLesson" class="lesson-select" onchange="Questions.fillExams()"></select><select id="qExam"></select></div>
      <select id="qType" onchange="Questions.setType(this.value)">
        <option value="mcq">اختيار من متعدد (نص)</option><option value="image">اختيار من متعدد (صورة)</option>
        <option value="tf">صح / خطأ</option><option value="essay">مقالي (تصحيح AI)</option><option value="file">رفع ملف أسئلة (.txt)</option></select>
      <div id="qForm">
        <textarea id="qText" rows="3" placeholder="نص السؤال" data-for="mcq tf essay"></textarea>
        <div class="grid" data-for="mcq"><input class="q-opt" placeholder="الاختيار أ"><input class="q-opt" placeholder="الاختيار ب"><input class="q-opt" placeholder="الاختيار ج"><input class="q-opt" placeholder="الاختيار د"></div>
        <input type="file" id="qImage" accept="image/*" data-for="image">
        <select id="qCorrect" data-for="mcq image"><option value="0">الإجابة: أ</option><option value="1">الإجابة: ب</option><option value="2">الإجابة: ج</option><option value="3">الإجابة: د</option></select>
        <select id="qTF" data-for="tf"><option value="true">الإجابة: صح</option><option value="false">الإجابة: خطأ</option></select>
        <textarea id="qModel" rows="3" placeholder="الإجابة النموذجية" data-for="essay"></textarea>
        <input type="number" id="qMax" value="5" min="1" max="20" placeholder="الدرجة" data-for="essay">
        <div data-for="file"><input type="file" id="qFile" accept=".txt">
          <pre class="item" style="direction:rtl;white-space:pre-wrap;font-size:12px">سؤال 1: ما عاصمة مصر؟
أ: القاهرة
ب: الإسكندرية
ج: الجيزة
د: الأقصر
الإجابة: أ

سؤال 2: القاهرة عاصمة مصر (صح/خطأ)
الإجابة: صح

سؤال 3: [مقالي] اشرح أسباب الثورة الفرنسية
الإجابة النموذجية: أسباب سياسية واقتصادية.
الدرجة: 5</pre></div>
      </div>
      <button class="btn ok full" onclick="Questions.add()">إضافة</button></div>
    <div class="card"><h3>📋 عرض الأسئلة</h3>
      <select id="vLesson" class="lesson-select" onchange="Questions.list()"></select><div id="qList"></div></div>`,

  init() { this.setType('mcq'); },
  setType(t) {
    this.type = t;
    document.querySelectorAll('#qForm [data-for]').forEach(el => el.classList.toggle('hidden', !el.dataset.for.split(' ').includes(t)));
  },
  fillExams() { $('qExam').innerHTML = Lessons.examOptions($('qLesson').value); },

  async add() {
    const lessonId = $('qLesson').value, ex = $('qExam').value, t = this.type;
    if (!lessonId || ex === '') return toast('⚠️ اختر الدرس والامتحان', true);
    const base = { lessonId, examIndex: +ex, createdAt: Date.now() }, text = $('qText').value.trim();
    try {
      let list = [];
      if (t === 'mcq') {
        const o = [...document.querySelectorAll('.q-opt')].map(i => i.value.trim());
        if (!text || o.some(x => !x)) throw 'أكمل السؤال والاختيارات';
        list = [{ ...base, questionText: text, options: o, correctAnswer: +$('qCorrect').value, isText: true }];
      } else if (t === 'image') {
        const f = $('qImage').files[0]; if (!f) throw 'اختر صورة';
        toast('⏳ جاري رفع الصورة...');
        list = [{ ...base, imageUrl: await uploadImage(f), correctAnswer: +$('qCorrect').value, isText: false }];
      } else if (t === 'tf') {
        if (!text) throw 'اكتب العبارة';
        list = [{ ...base, questionText: text, correctAnswer: $('qTF').value === 'true', isText: true, isTrueFalse: true }];
      } else if (t === 'essay') {
        const m = $('qModel').value.trim(); if (!text || !m) throw 'أكمل السؤال والإجابة النموذجية';
        list = [{ ...base, questionText: text, modelAnswer: m, maxScore: +$('qMax').value || 5, isEssay: true }];
      } else {
        const f = $('qFile').files[0]; if (!f) throw 'اختر ملفاً';
        list = this.parse(await f.text()).map(q => ({ ...base, ...q }));
        if (!list.length) throw 'لم يتم العثور على أسئلة صالحة';
      }
      const up = {}; list.forEach(q => up[db.ref('questions').push().key] = q);
      await db.ref('questions').update(up);
      toast(`✅ تمت إضافة ${list.length} سؤال`);
      ['qText', 'qModel'].forEach(i => $(i).value = ''); document.querySelectorAll('.q-opt').forEach(i => i.value = '');
      $('qImage').value = ''; $('qFile').value = '';
    } catch (e) { toast('❌ ' + (e.message || e), true); }
  },

  parse(txt) {
    const A = { 'أ': 0, 'ا': 0, 'ب': 1, 'ج': 2, 'د': 3 }, raw = []; let q = null, m;
    for (const line of txt.split('\n')) {
      const l = line.trim(); if (!l) continue;
      if ((m = l.match(/^(?:سؤال\s*)?\d+\s*[:：.\-]\s*(.+)/))) {
        if (q) raw.push(q);
        q = { t: m[1], opts: [], ans: null, model: '', max: 5 };
        q.tf = /\(صح\/خطأ\)/.test(q.t); q.es = /[\[(]مقالي[\])]/.test(q.t);
        q.t = q.t.replace(/\(صح\/خطأ\)|[\[(]مقالي[\])]/g, '').trim();
      } else if (!q) continue;
      else if ((m = l.match(/^الإجابة النموذجية\s*[:：]\s*(.+)/))) q.model = m[1];
      else if ((m = l.match(/^الدرجة\s*[:：]\s*(\d+)/))) q.max = +m[1];
      else if ((m = l.match(/^الإجابة\s*[:：]\s*(.+)/))) q.ans = m[1].trim();
      else if ((m = l.match(/^([أابجد])\s*[:：\-]\s*(.+)/))) q.opts.push(m[2]);
    }
    if (q) raw.push(q);
    return raw.map(q => {
      const b = { questionText: q.t, isText: true };
      if (q.es) return q.model ? { ...b, isEssay: true, modelAnswer: q.model, maxScore: q.max } : null;
      if (q.tf) return (q.ans === 'صح' || q.ans === 'خطأ') ? { ...b, isTrueFalse: true, correctAnswer: q.ans === 'صح' } : null;
      return (q.opts.length === 4 && A[q.ans] !== undefined) ? { ...b, options: q.opts, correctAnswer: A[q.ans] } : null;
    }).filter(Boolean);
  },

  async list() {
    const id = $('vLesson').value, box = $('qList');
    if (!id) { box.innerHTML = ''; return; }
    const qs = (await db.ref('questions').orderByChild('lessonId').equalTo(id).once('value')).val() || {};
    const exams = (Lessons.data[id] || {}).exams || [], L = ['أ', 'ب', 'ج', 'د'];
    box.innerHTML = Object.keys(qs).map(k => {
      const q = qs[k];
      const ans = q.isEssay ? `مقالي (${q.maxScore})` : q.isTrueFalse ? (q.correctAnswer ? 'صح' : 'خطأ') : L[q.correctAnswer] || '؟';
      return `<div class="item"><div>${q.imageUrl ? `<img src="${esc(q.imageUrl)}" style="max-width:110px;border-radius:8px;display:block">` : ''}
        <strong>${esc(q.questionText || '(سؤال صورة)')}</strong>
        <div class="meta">✅ ${ans} • ${esc((exams[q.examIndex] || {}).name || 'امتحان ' + (q.examIndex + 1))}</div></div>
        <button class="btn sm bad" onclick="Questions.remove('${k}')"><i class="fas fa-trash"></i></button></div>`;
    }).join('') || '<p class="empty">لا توجد أسئلة</p>';
  },
  async remove(k) { if (!confirm('حذف السؤال؟')) return; await db.ref('questions/' + k).remove(); this.list(); }
};
App.register(Questions);
