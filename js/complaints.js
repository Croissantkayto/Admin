// التظلمات
const Complaints = {
  id: 'complaints', title: 'التظلمات', icon: '⚖️',
  html: '<div class="card"><h3>⚖️ التظلمات</h3><div id="cList"></div></div>',
  init() {
    db.ref('complaints').on('value', (s) => {
      const c = s.val();
      $('cList').innerHTML = !c ? '<p class="empty">لا توجد تظلمات</p>' : Object.keys(c).reverse().map(id => {
        const x = c[id], done = x.status === 'resolved';
        return `<div class="item" style="border-right-color:${done ? 'var(--ok)' : 'var(--bad)'};flex-direction:column;align-items:stretch">
          <div class="row" style="justify-content:space-between"><div><strong>${esc(x.studentName)}</strong> - ${esc(x.lessonName)}</div>
          <span style="color:${done ? 'var(--ok)' : 'var(--bad)'}">${done ? '✅ تمت المراجعة' : '⏳ قيد المراجعة'}</span></div>
          <div style="font-size:13px"><p><b>السؤال:</b> ${esc(x.questionText)}</p><p><b>إجابة الطالب:</b> ${esc(x.studentAnswer)}</p>
          <p><b>تصحيح الـ AI:</b> ${x.aiScore ?? '?'} / ${esc(x.maxScore)} - ${esc(x.aiFeedback)}</p><p><b>سبب التظلم:</b> ${esc(x.reason)}</p></div>
          ${done ? `<div class="meta">${x.resolutionType === 'accept' ? '✅ تم تأكيد درجة الـ AI' : '✏️ تم تعديل الدرجة إلى: ' + esc(x.newScore)}</div>`
            : `<div class="row"><button class="btn sm ok" onclick="Complaints.resolve('${id}','${esc(x.attemptId)}','${esc(x.questionId)}','accept')">تأكيد درجة الـ AI</button>
               <button class="btn sm warn" onclick="Complaints.resolve('${id}','${esc(x.attemptId)}','${esc(x.questionId)}','edit')">تعديل الدرجة</button></div>`}</div>`;
      }).join('');
    });
  },
  async resolve(cid, aid, qid, type) {
    try {
      const [c, a, q] = await Promise.all([`complaints/${cid}`, `studentAttempts/${aid}`, `questions/${qid}`].map(p => db.ref(p).once('value').then(s => s.val())));
      if (!c || !a) return toast('❌ بيانات التظلم أو المحاولة غير موجودة', true);
      const max = Number(q?.maxScore ?? c.maxScore) || 0, now = Date.now(), up = {};
      if (type === 'accept') {
        if (!confirm('تأكيد درجة الـ AI؟')) return;
        up[`complaints/${cid}/status`] = 'resolved'; up[`complaints/${cid}/resolutionType`] = 'accept'; up[`complaints/${cid}/resolvedAt`] = now;
        up[`studentAttempts/${aid}/complaints/${cid}/status`] = 'resolved';
      } else {
        let old = (a.essayScores || {})[qid];
        if (old === undefined) { old = parseFloat(prompt('محاولة قديمة: اكتب الدرجة اللي كان واخدها الطالب في السؤال ده:')); if (isNaN(old)) return toast('⚠️ رقم غير صحيح', true); }
        const n = parseFloat(prompt(`أدخل الدرجة الجديدة (من 0 إلى ${max}):`));
        if (isNaN(n) || n < 0 || n > max) return toast(`⚠️ الدرجة لازم تكون بين 0 و ${max}`, true);
        const total = a.totalQuestions || 0, nt = Math.max(0, Math.round(((a.score || 0) - old + n) * 100) / 100);
        Object.assign(up, {
          [`studentAttempts/${aid}/score`]: nt, [`studentAttempts/${aid}/percentage`]: total ? Math.round(nt / total * 100) : 0,
          [`studentAttempts/${aid}/essayScores/${qid}`]: n,
          [`studentAttempts/${aid}/essayFeedbacks/${qid}`]: `تمت مراجعة الدرجة يدوياً بناءً على تظلمك. الدرجة بعد المراجعة: ${n} / ${max}`,
          [`studentAttempts/${aid}/complaints/${cid}/status`]: 'resolved', [`studentAttempts/${aid}/complaints/${cid}/newScore`]: n,
          [`complaints/${cid}/status`]: 'resolved', [`complaints/${cid}/resolutionType`]: 'edit', [`complaints/${cid}/newScore`]: n, [`complaints/${cid}/resolvedAt`]: now });
      }
      up[`studentAttempts/${aid}/complaints/${cid}/resolvedAt`] = now;   // لإشعار الطالب
      await db.ref().update(up);
      Grading.bump((await db.ref('studentAttempts/' + aid).once('value')).val());
      toast('✅ تم');
    } catch (e) { toast('❌ ' + e.message, true); }
  }
};
App.register(Complaints);
