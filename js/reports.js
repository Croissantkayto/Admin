// التقارير والواتساب (فردي + جماعي + معاينة)
const HEAD = 'السلام عليكم،\nمع حضرتك متابعة أ. أحمد رزق - مدرس التاريخ';
const Reports = {
  id: 'reports', title: 'التقارير', icon: '📤',
  html: `<div class="card"><h3>📤 إرسال التقارير (واتساب)</h3>
    <p class="meta">تأكد من تشغيل سيرفر الواتساب قبل الإرسال.</p>
    <div class="grid"><div><label>الصف</label><select id="rpGrade" onchange="Reports.fillStudents()">${gradeOptions(true)}</select></div>
      <div><label>الطالب</label><select id="rpStudent"><option value="all">كل الطلاب</option></select></div></div>
    <div class="grid"><div><label>الدرس</label><select id="rpLesson" class="lesson-select" onchange="$('rpExam').innerHTML=Lessons.examOptions(this.value)"></select></div>
      <div><label>الامتحان</label><select id="rpExam"></select></div></div>
    <div class="item"><div><b>1. تقرير الدرجة والغياب</b></div><div class="row">
      <button class="btn sm line" onclick="Reports.run('exam',false)">👁 معاينة</button><button class="btn sm ok" onclick="Reports.run('exam',true)">إرسال فعلي</button></div></div>
    <div class="item"><div><b>2. التقرير العام التراكمي</b></div><div class="row">
      <button class="btn sm line" onclick="Reports.run('general',false)">👁 معاينة</button><button class="btn sm ok" onclick="Reports.run('general',true)">إرسال فعلي</button></div></div></div>`,

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
  async send(phone, message) {
    const p = this.phone(phone); if (!/^\d{10,15}$/.test(p)) return false;
    try { const r = await fetch(CFG.WA_URL + '/send-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: p, message }) }); return (await r.json()).success; }
    catch (e) { return false; }
  },
  async sendOne(attId) {   // تقرير محاولة واحدة من نافذة امتحانات الطالب
    const a = Students.att[attId], s = Students.data[a.studentId] || {};
    if (!confirm(`إرسال تقرير ${a.studentName} إلى ${s.parentPhone}؟`)) return;
    const ok = await this.send(s.parentPhone, `مرحباً،\n\nتقرير عن الطالب: ${a.studentName}\nالدرس: ${a.lessonName}\nالدرجة: ${a.score} من ${a.totalQuestions}\n\nمنصة العبور - أ. أحمد رزق`);
    toast(ok ? '✅ تم إرسال التقرير' : '❌ فشل الإرسال (تأكد من السيرفر ورقم ولي الأمر)', !ok);
  },
  general(s, id, att, gl, total) {
    const last = {}; att.forEach(a => { if (a.studentId === id) { const k = a.lessonId + '_' + a.examIndex; if (!last[k] || a.timestamp > last[k].timestamp) last[k] = a; } });
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
  async run(type, real) {
    const grade = $('rpGrade').value, sid = $('rpStudent').value, lid = $('rpLesson').value, ex = $('rpExam').value;
    if (grade === 'all') return toast('⚠️ اختر الصف أولاً', true);
    if (type === 'exam' && (!lid || ex === '')) return toast('⚠️ اختر الدرس والامتحان', true);
    const stu = Object.entries(Students.data).filter(([id, s]) => s.grade === grade && (sid === 'all' || id === sid));
    if (!stu.length) return toast('لا يوجد طلاب', true);
    const att = Object.values(await read('studentAttempts')), L = Lessons.data;
    const gl = Object.keys(L).filter(i => L[i].grade === grade && L[i].isPublished).map(i => ({ id: i, ...L[i] }));
    const total = gl.reduce((s, l) => s + (l.exams || []).length, 0);
    const msgs = stu.map(([id, s]) => {
      let m;
      if (type === 'exam') {
        const lesson = L[lid], e = lesson.exams[ex];
        const a = att.filter(x => x.studentId === id && x.lessonId === lid && +x.examIndex === +ex).sort((p, q) => q.timestamp - p.timestamp)[0];
        m = a ? `${HEAD}\n\nتقرير عن الطالب: ${s.fullName}\n📖 الدرس: ${lesson.name}\n📝 الامتحان: ${e.name}\nالدرجة: ${a.score} من ${a.totalQuestions} (${a.percentage}%)\n\nمنصة العبور.`
          : `${HEAD}\n\nنود إعلامكم بأن الطالب: ${s.fullName}\nلم يحضر : ${e.name}\nمن درس: ${lesson.name}\n\nمنصة العبور.`;
      } else m = this.general(s, id, att, gl, total);
      return { s, m };
    });
    if (!real) return modal(`<h3>معاينة (${msgs.length} رسالة)</h3>` + msgs.map(x => `<div class="item" style="display:block"><b>${esc(x.s.fullName)}</b> <small>${esc(x.s.parentPhone || 'بدون رقم')}</small><pre style="white-space:pre-wrap;font-size:13px;margin-top:6px">${esc(x.m)}</pre></div>`).join(''));
    if (!confirm(`تأكيد الإرسال لـ ${msgs.length} طالب؟`)) return;
    let ok = 0, fail = 0; toast('⏳ بدأ الإرسال...');
    for (const x of msgs) { if (x.s.parentPhone && await this.send(x.s.parentPhone, x.m)) ok++; else fail++; await sleep(1500); }
    toast(`✅ انتهى الإرسال — نجح: ${ok} / فشل: ${fail}`);
  }
};
App.register(Reports);
