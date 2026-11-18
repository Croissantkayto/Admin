// النتائج: حضر / لم يحضر + الخروج من صفحة الامتحان
const Results = {
  id: 'results', title: 'النتائج', icon: '📊', tab: 'attended',
  html: `<div class="card"><h3>📊 نتائج الطلاب</h3>
    <div class="grid"><select id="rLessonSel" class="lesson-select" onchange="$('rExamSel').innerHTML=Lessons.examOptions(this.value);Results.load()"></select>
    <select id="rExamSel" onchange="Results.load()"></select></div>
    <div class="row" style="margin:12px 0"><button id="tbA" class="btn sm ok" onclick="Results.show('attended')">حضر (<span id="cA">0</span>)</button>
    <button id="tbB" class="btn sm line" onclick="Results.show('absent')">لم يحضر (<span id="cB">0</span>)</button>
    <button class="btn sm warn" onclick="Results.leave()">🕵️ الخروج من الصفحة</button></div>
    <div id="resA"><p class="empty">اختر الدرس والامتحان</p></div><div id="resB" class="hidden"></div><div id="resLeave"></div></div>`,
  show(t) {
    $('resA').classList.toggle('hidden', t !== 'attended'); $('resB').classList.toggle('hidden', t !== 'absent');
    $('tbA').className = 'btn sm ' + (t === 'attended' ? 'ok' : 'line'); $('tbB').className = 'btn sm ' + (t === 'absent' ? 'ok' : 'line');
  },
  async latest(lessonId, ex) {
    const m = {};
    Object.values(await read('studentAttempts')).forEach(a => {
      if (a.lessonId === lessonId && +a.examIndex === +ex && (!m[a.studentId] || a.timestamp > m[a.studentId].timestamp)) m[a.studentId] = a;
    });
    return m;
  },
  async load() {
    const id = $('rLessonSel').value, ex = $('rExamSel').value, l = Lessons.data[id];
    if (!l || ex === '') return;
    const att = await this.latest(id, ex);
    const stu = Object.entries(Students.data).filter(([, s]) => s.grade === l.grade);
    const A = stu.filter(([k]) => att[k]).map(([k, s]) => ({ s, a: att[k] })).sort((x, y) => y.a.percentage - x.a.percentage);
    const B = stu.filter(([k]) => !att[k]).map(([, s]) => s).sort((x, y) => (x.fullName || '').localeCompare(y.fullName || ''));
    $('cA').textContent = A.length; $('cB').textContent = B.length;
    const row = (i, s, right, col) => `<div class="item" style="border-right-color:${col}"><div><strong>${i}. ${esc(s.fullName)}</strong>
      <div class="meta">${GRADES[s.grade] || ''} • 📱 ${esc(s.phone || '-')} • 👨‍👦 ${esc(s.parentPhone || '-')}</div></div><div>${right}</div></div>`;
    $('resA').innerHTML = A.map((x, i) => { const ok = x.a.percentage >= 50;
      return row(i + 1, x.s, `<b style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${x.a.score}/${x.a.totalQuestions} (${x.a.percentage}%) ${ok ? '✅' : '❌'}</b>`, ok ? 'var(--ok)' : 'var(--bad)'); }).join('') || '<p class="empty">لا يوجد طلاب حضروا</p>';
    $('resB').innerHTML = B.map((s, i) => row(i + 1, s, '<b style="color:var(--warn)">❌ لم يحضر</b>', 'var(--warn)')).join('') || '<p class="empty">🎉 كل الطلاب حضروا!</p>';
  },
  async leave() {
    const id = $('rLessonSel').value, ex = $('rExamSel').value;
    if (!id || ex === '') return toast('⚠️ اختر الدرس والامتحان', true);
    const list = Object.values(await read('studentAttempts')).filter(a => a.lessonId === id && +a.examIndex === +ex && (a.tabLeaves || 0) > 0).sort((a, b) => b.tabLeaves - a.tabLeaves);
    $('resLeave').innerHTML = '<h4 style="margin-top:14px">🕵️ خرجوا من صفحة الامتحان</h4>' + (list.map(a => `<div class="item" style="border-right-color:var(--warn)"><div><strong>${esc(a.studentName)}</strong>
      <div class="meta">${a.score}/${a.totalQuestions} (${a.percentage}%)</div></div><span class="badge off">خرج ${a.tabLeaves} مرة</span></div>`).join('') || '<p style="color:var(--ok)">✅ ما فيش حد خرج</p>');
  }
};
App.register(Results);
