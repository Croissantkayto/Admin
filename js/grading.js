// تصحيح المقالي بالـ AI + لوحة الشرف (بيشتغل مرة بعد الدخول)
const Grading = {
  done: false,
  async bump(a) {
    try {
      if (!a || a.needsGrading || !a.studentId) return;
      const ref = db.ref(`leaderboard/${a.lessonId}_${a.examIndex}/${a.studentId}`), old = (await ref.once('value')).val();
      if (old && old.percentage >= a.percentage) return;
      const s = (await db.ref('students/' + a.studentId).once('value')).val() || {};
      const name = `${s.firstName || ''} ${s.fatherName || ''}`.trim() || a.studentName || 'طالب';
      await ref.set({ name, percentage: a.percentage, score: a.score, total: a.totalQuestions, timestamp: Date.now() });
    } catch (e) { console.error('leaderboard', e); }
  },
  async process() {
    if (this.done) return; this.done = true;
    const all = (await db.ref('studentAttempts').orderByChild('needsGrading').equalTo(true).once('value')).val();
    if (!all) return;
    for (const key of Object.keys(all)) {
      const a = all[key], qs = a.essayQuestionsToGrade || []; if (!qs.length) continue;
      let sum = 0, ok = true; const fb = {}, sc = {};
      for (const q of qs) {
        const ans = String((a.answers || {})[q.id] || '');
        if (!ans.trim()) { fb[q.id] = 'لم يتم تقديم إجابة.'; sc[q.id] = 0; continue; }
        try {
          const r = await fetch(CFG.GRADER_URL + '/grade-essay', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionText: q.questionText, modelAnswer: q.modelAnswer, studentAnswer: ans, maxScore: q.maxScore }) });
          const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'AI Error');
          sum += d.score; fb[q.id] = d.feedback; sc[q.id] = d.score;
        } catch (e) { console.error('grade', q.id, e); ok = false; break; }
        await sleep(1000);
      }
      if (!ok) continue;
      const max = qs.reduce((s, q) => s + (Number(q.maxScore) || 0), 0), score = (a.objectiveScore || 0) + sum, total = (a.totalQuestions || 0) + max;
      const upd = { score, totalQuestions: total, percentage: total ? Math.round(score / total * 100) : 0, essayFeedbacks: { ...(a.essayFeedbacks || {}), ...fb }, essayScores: sc, needsGrading: false };
      await db.ref('studentAttempts/' + key).update(upd);
      this.bump({ ...a, ...upd });
    }
  }
};
