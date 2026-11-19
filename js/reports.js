// التقارير والواتساب (فردي + جماعي + معاينة)
const HEAD = 'السلام عليكم،\nمع حضرتك متابعة أ. أحمد رزق - مدرس التاريخ';
const Reports = {
  id: 'reports', title: 'التقارير', icon: '📤',
  html: `<div class="card"><h3>📤 إرسال التقارير (واتساب)</h3>
    <p class="meta">الرسايل بتتضاف لطابور وسيرفر الواتساب بيبعتها لوحده (تابعها من تبويب الأتمتة).</p>
    <div class="grid"><div><label>الصف</label><select id="rpGrade" onchange="Reports.fillStudents()">${gradeOptions(true)}</select></div>
      <div><label>الطالب</label><select id="rpStudent"><option value="all">كل الطلاب</option></select></div></div>
    <div class="grid"><div><label>الدرس</label><select id="rpLesson" class="lesson-select" onchange="$('rpExam').innerHTML=Lessons.examOptions(this.value)"></select></div>
      <div><label>الامتحان</label><select id="rpExam"></select></div></div>
    <div class="item"><div><b>1. تقرير الدرجة والغياب</b></div><div class="row">
      <button class="btn sm line" onclick="Reports.run('exam',false)">👁 معاينة</button><button class="btn sm ok" onclick="Reports.run('exam',true)">إرسال فعلي</button></div></div>
    <div class="item"><div><b>2. التقرير العام التراكمي</b></div><div class="row">
      <button class="btn sm line" onclick="Reports.run('general',false)">👁 معاينة</button><button class="btn sm ok" onclick="Reports.run('general',true)">إرسال فعلي</button></div></div>
    <div class="item"><div><b>3. تقرير آخر محاضرة</b><div class="meta">آخر درس منشور فيه امتحانات في الصف المختار</div></div><div class="row">
      <button class="btn sm line" onclick="Reports.lastSummary()">📊 ملخص كل الصفوف</button><button class="btn sm line" onclick="Reports.run('last',false)">👁 معاينة</button><button class="btn sm ok" onclick="Reports.run('last',true)">إرسال فعلي</button></div></div></div>`,

  fillStudents() {
    const g = $('rpGrade').value;
    $('rpStudent').innerHTML = '<option value="all">كل الطلاب</option>' + (g === 'all' ? '' :
      Object.entries(Students.data).filter(([, s]) => s.grade === g).map(([id, s]) => `<option value="${id}">${esc(s.fullName)}</option>`).join(''));
  },
  phone(raw) {
    let p = String(raw ?? '').replace(/\D/g, '');
    if (p.startsWith('00')) p = p.slice(2);
    if (p.startsWith('20')) return p; if (p.startsWith('0')) return '20' + p.slice(1);
    return (p.length === 10 && p[0] === '1') ? '20' + p : p;
  },
  async send(phone, message, meta = {}) {   // بيضيف الرسالة لطابور Firebase والسيرفر بيبعتها
    const p = this.phone(phone); if (!/^\d{10,15}$/.test(p)) return false;
    await db.ref('waQueue').push({ phone: p, message, status: 'pending', createdAt: Date.now(), type: 'يدوي', ...meta }); return true;
  },
  async sendOne(attId) {   // تقرير محاولة واحدة من نافذة امتحانات الطالب
    const a = Students.att[attId], s = Students.data[a.studentId] || {};
    if (!confirm(`إرسال تقرير ${a.studentName} إلى ${s.parentPhone}؟`)) return;
    const ok = await this.send(s.parentPhone, `مرحباً،\n\nتقرير عن الطالب: ${a.studentName}\nالدرس: ${a.lessonName}\nالدرجة: ${a.score} من ${a.totalQuestions}\n\nمنصة العبور - أ. أحمد رزق`);
    toast(ok ? '✅ اتضاف لطابور الإرسال' : '❌ رقم ولي الأمر غير صالح', !ok);
  },
  general(s, id, att, gl, total) {
    const last = {}; att.forEach(a => { if (a.studentId === id) { const k = a.lessonId + '_' + a.examIndex; if (this.better(a, last[k])) last[k] = a; } });
    let d = '📋 تفاصيل المنهج:\n\n', n = 0, sum = 0;
    gl.forEach(l => { if (!(l.exams || []).length) return; d += `📖 الدرس: ${l.name}\n`;
      l.exams.forEach((e, i) => { const m = last[l.id + '_' + i];
        if (m) { d += `   - ${e.name}: ${m.score} من ${m.totalQuestions} (${m.percentage}%)\n`; n++; sum += m.percentage; } else d += `   - ${e.name}: ⚠️ لم يحضر\n`; });
      d += '\n'; });
    const rate = total ? Math.round(n / total * 100) : 0, avg = n ? Math.round(sum / n) : 0;
    const tip = !n ? 'ياريت نحفزه إنه يبدأ يحضر الامتحانات عشان نقدر نتابع مستواه.' : rate < 90 ? 'ننصحه بالالتزام أكثر وحضور جميع الامتحانات، لأن الالتزام هو أساس النجاح.'
      : avg >= 90 ? 'مبارك عليه! وإن شاء الله يكمل بنفس التفوق والالتزام.' : 'التزامه ممتاز، وياريت نشد عليه شوية في المذاكرة عشان يوصل لأفضل نتيجة.';
    return `${HEAD}\n\nالتقرير العام للطالب: ${s.fullName}\n\n${d}📊 إجمالي الامتحانات اللي حضرها: ${n} من أصل ${total}\n✅ نسبة الحضور (الالتزام): ${rate}%\n📈 متوسط الدرجات: ${avg}%\n\n${tip}\n\nمنصة العبور.`;
  },
  better(a, b) { return !b || a.percentage > b.percentage || (a.percentage === b.percentage && a.timestamp > b.timestamp); },
  best(att, sid, lid, i) { let r = null; att.forEach(a => { if (a.studentId === sid && a.lessonId === lid && +a.examIndex === +i && this.better(a, r)) r = a; }); return r; },
  lastLesson(gl) { return gl.filter(l => (l.exams || []).length).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]; },
  lastMsg(s, id, att, l) {
    let n = 0, sum = 0, d = '';
    l.exams.forEach((e, i) => { const m = this.best(att, id, l.id, i);
      if (m) { d += `📝 ${e.name}: ${m.score} من ${m.totalQuestions} (${m.percentage}%)\n`; n++; sum += m.percentage; } else d += `📝 ${e.name}: ⚠️ لم يحضر\n`; });
    return `${HEAD}\n\nتقرير الطالب: ${s.fullName}\n📖 آخر محاضرة: ${l.name}\n\n${d}\n📊 حضر ${n} من ${l.exams.length} امتحان\n📈 المتوسط: ${n ? Math.round(sum / n) : 0}%\n\nمنصة العبور.`;
  },
  async lastSummary() {   // ملخص آخر محاضرة لكل صف (للمتابعة)
    const att = Object.values(await read('studentAttempts')), L = Lessons.data; let html = '<h3>📊 آخر محاضرة لكل صف</h3>';
    for (const g of Object.keys(GRADES)) {
      const gl = Object.keys(L).filter(i => L[i].grade === g && L[i].isPublished).map(i => ({ id: i, ...L[i] })), ll = this.lastLesson(gl);
      const stu = Object.keys(Students.data).filter(id => Students.data[id].grade === g);
      html += `<div class="item" style="display:block"><b>${GRADES[g]}</b> — ${ll ? '📖 ' + esc(ll.name) : 'لا توجد محاضرة بامتحانات'} <small>(${stu.length} طالب)</small>`;
      if (ll) ll.exams.forEach((e, i) => {
        const last = {}; att.forEach(a => { if (a.lessonId === ll.id && +a.examIndex === i && this.better(a, last[a.studentId])) last[a.studentId] = a; });
        const v = stu.map(id => last[id]).filter(Boolean), avg = v.length ? Math.round(v.reduce((x, a) => x + a.percentage, 0) / v.length) : 0;
        html += `<div class="meta">📝 ${esc(e.name)}: حضر ${v.length} من ${stu.length} • المتوسط ${avg}%</div>`; });
      html += '</div>';
    }
    modal(html);
  },
  async run(type, real) {
    const grade = $('rpGrade').value, sid = $('rpStudent').value, lid = $('rpLesson').value, ex = $('rpExam').value;
    if (grade === 'all') return toast('⚠️ اختر الصف أولاً', true);
    if (type === 'exam' && (!lid || ex === '')) return toast('⚠️ اختر الدرس والامتحان', true);
    const stu = Object.entries(Students.data).filter(([id, s]) => s.grade === grade && (sid === 'all' || id === sid));
    if (!stu.length) return toast('لا يوجد طلاب', true);
    const att = Object.values(await read('studentAttempts')), L = Lessons.data;
    const gl = Object.keys(L).filter(i => L[i].grade === grade && L[i].isPublished).map(i => ({ id: i, ...L[i] }));
    const total = gl.reduce((s, l) => s + (l.exams || []).length, 0);
    if (type === 'last' && !this.lastLesson(gl)) return toast('⚠️ مفيش درس منشور فيه امتحانات للصف ده', true);
    const msgs = stu.map(([id, s]) => {
      let m;
      if (type === 'exam') {
        const lesson = L[lid], e = lesson.exams[ex];
        const a = this.best(att, id, lid, ex);
        m = a ? `${HEAD}\n\nتقرير عن الطالب: ${s.fullName}\n📖 الدرس: ${lesson.name}\n📝 الامتحان: ${e.name}\nأعلى درجة: ${a.score} من ${a.totalQuestions} (${a.percentage}%)\n\nمنصة العبور.`
          : `${HEAD}\n\nنود إعلامكم بأن الطالب: ${s.fullName}\nلم يحضر : ${e.name}\nمن درس: ${lesson.name}\n\nمنصة العبور.`;
      } else if (type === 'last') m = this.lastMsg(s, id, att, this.lastLesson(gl));
      else m = this.general(s, id, att, gl, total);
      return { s, m };
    });
    if (!real) return modal(`<h3>معاينة (${msgs.length} رسالة)</h3>` + msgs.map(x => `<div class="item" style="display:block"><b>${esc(x.s.fullName)}</b> <small>${esc(x.s.parentPhone || 'بدون رقم')}</small><pre style="white-space:pre-wrap;font-size:13px;margin-top:6px">${esc(x.m)}</pre></div>`).join(''));
    if (!confirm(`تأكيد الإرسال لـ ${msgs.length} طالب؟`)) return;
    let ok = 0, fail = 0; toast('⏳ بدأ الإرسال...');
    for (const x of msgs) { if (x.s.parentPhone && await this.send(x.s.parentPhone, x.m, { name: x.s.fullName })) ok++; else fail++; }
    toast(`✅ تمت جدولة ${ok} رسالة (أرقام غير صالحة: ${fail}) — السيرفر هيبعتها تلقائياً`);
  }
};
App.register(Reports);
