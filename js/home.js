// الرئيسية + الأدوات (تصدير / نسخ احتياطي)
const Home = {
  id: 'home', title: 'الرئيسية', icon: '🏠',
  html: `
    <div class="card"><h3>📊 نظرة عامة</h3><div id="hStats" class="stats"></div></div>
    <div class="card"><h3>🏆 أعلى 5 طلاب</h3><div id="hTop"></div></div>
    <div class="card"><h3>⚠️ دروس منشورة بدون أسئلة</h3><div id="hWarn"></div></div>
    <div class="card"><h3>🧰 التصدير والنسخ الاحتياطي</h3>
      <div class="grid"><select id="hLesson" class="lesson-select" onchange="$('hExam').innerHTML=Lessons.examOptions(this.value)"></select><select id="hExam"></select></div>
      <div class="row" style="margin-top:8px">
        <button class="btn ok" onclick="Home.exportResults()">📄 تصدير نتائج الامتحان</button>
        <button class="btn line" onclick="Home.exportStudents()">👥 تصدير الطلاب</button>
        <button class="btn warn" onclick="Home.backup()">💾 نسخة احتياطية JSON</button></div></div>`,
  onOpen() { this.render(); },

  async render() {
    const [lessons, qs, students, attempts] = await Promise.all(['lessons', 'questions', 'students', 'studentAttempts'].map(read));
    const att = Object.values(attempts), avg = att.length ? Math.round(att.reduce((s, a) => s + (a.percentage || 0), 0) / att.length) : 0;
    const st = (n, l) => `<div class="stat"><b>${n}</b>${l}</div>`;
    $('hStats').innerHTML = st(Object.keys(students).length, '👥 طالب') + st(Object.keys(lessons).length, '📚 درس') + st(Object.keys(qs).length, '❓ سؤال') + st(att.length, '📝 محاولة') + st(avg + '%', '📈 المعدل');
    const per = {};
    att.forEach(a => { const p = per[a.studentId] = per[a.studentId] || { n: a.studentName, s: 0, c: 0 }; p.s += a.percentage || 0; p.c++; });
    const top = Object.values(per).map(p => ({ ...p, avg: Math.round(p.s / p.c) })).sort((a, b) => b.avg - a.avg).slice(0, 5);
    $('hTop').innerHTML = top.map((t, i) => `<div class="item"><span>${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} <strong>${esc(t.n)}</strong></span><span>${t.avg}% • ${t.c} امتحان</span></div>`).join('') || '<p class="empty">لا توجد بيانات</p>';
    const cnt = {}; Object.values(qs).forEach(q => cnt[q.lessonId] = (cnt[q.lessonId] || 0) + 1);
    const warn = Object.keys(lessons).filter(i => lessons[i].isPublished && !cnt[i]);
    $('hWarn').innerHTML = warn.map(i => `<div class="item" style="border-right-color:var(--warn)">${esc(lessons[i].name)} <small>${GRADES[lessons[i].grade] || ''}</small></div>`).join('') || '<p class="empty">✅ كل الدروس المنشورة فيها أسئلة</p>';
  },
  async exportResults() {
    const id = $('hLesson').value, ex = $('hExam').value;
    if (!id || ex === '') return toast('⚠️ اختر الدرس والامتحان', true);
    const l = Lessons.data[id];
    const students = (await db.ref('students').orderByChild('grade').equalTo(l.grade).once('value')).val() || {};
    const last = {};
    Object.values(await read('studentAttempts')).forEach(a => { if (a.lessonId === id && +a.examIndex === +ex && (!last[a.studentId] || a.timestamp > last[a.studentId].timestamp)) last[a.studentId] = a; });
    const rows = [['الاسم', 'الصف', 'هاتف الطالب', 'هاتف ولي الأمر', 'الحالة', 'الدرجة', 'من', 'النسبة %']];
    Object.keys(students).forEach(k => { const s = students[k], a = last[k]; rows.push([s.fullName, GRADES[s.grade], s.phone, s.parentPhone, a ? 'حضر' : 'غائب', a ? a.score : '', a ? a.totalQuestions : '', a ? a.percentage : '']); });
    download(`نتائج-${l.name}.csv`, toCSV(rows), 'text/csv;charset=utf-8'); toast('✅ تم التصدير');
  },
  async exportStudents() {
    const rows = [['الاسم', 'الصف', 'هاتف الطالب', 'هاتف ولي الأمر', 'محظور']];
    Object.values(await read('students')).forEach(s => rows.push([s.fullName, GRADES[s.grade], s.phone, s.parentPhone, s.isBlocked ? 'نعم' : 'لا']));
    download('الطلاب.csv', toCSV(rows), 'text/csv;charset=utf-8');
  },
  async backup() {
    toast('⏳ جاري التجهيز...');
    const out = {}; for (const k of ['lessons', 'questions', 'students', 'studentAttempts', 'units', 'announcements', 'complaints']) out[k] = (await db.ref(k).once('value')).val();
    download(`backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out), 'application/json'); toast('✅ تم');
  }
};
App.register(Home);
