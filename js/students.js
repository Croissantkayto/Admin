// إدارة الطلاب
const Students = {
  id: 'students', title: 'الطلاب', icon: '👥', data: {}, att: {},
  html: `<div class="card"><h3>👥 إدارة الطلاب</h3>
    <div class="grid"><select id="sGrade" onchange="Students.render()">${gradeOptions(true)}</select><input id="sSearch" placeholder="بحث بالاسم أو الرقم"></div>
    <div id="sList"></div></div>`,
  init() {
    db.ref('students').on('value', (s) => { this.data = s.val() || {}; this.render(); });
    $('sSearch').oninput = debounce(() => this.render());
  },
  render() {
    const g = $('sGrade').value, q = $('sSearch').value.toLowerCase();
    const rows = Object.keys(this.data).filter(id => {
      const s = this.data[id];
      return (g === 'all' || s.grade === g) && (!q || (s.fullName || '').toLowerCase().includes(q) || (s.phone || '').includes(q));
    }).map(id => { const s = this.data[id], b = !!s.isBlocked;
      return `<div class="item" style="${b ? 'border-right-color:var(--bad)' : ''}"><div><strong>${esc(s.fullName || 'بدون اسم')}</strong>
        ${b ? '<span class="badge off">محظور</span>' : ''}<div class="meta">${GRADES[s.grade] || 'غير محدد'} • 📱 ${esc(s.phone || '-')} • 👨‍👦 ${esc(s.parentPhone || '-')}</div></div>
        <div class="row"><button class="btn sm line" onclick="Students.viewExams('${id}')" title="الامتحانات"><i class="fas fa-eye"></i></button>
        <button class="btn sm warn" onclick="Students.changeGrade('${id}')" title="تغيير الصف"><i class="fas fa-edit"></i></button>
        <button class="btn sm ${b ? 'ok' : 'bad'}" onclick="Students.block('${id}')"><i class="fas ${b ? 'fa-unlock' : 'fa-ban'}"></i></button>
        <button class="btn sm bad" onclick="Students.remove('${id}')"><i class="fas fa-trash"></i></button></div></div>`; });
    $('sList').innerHTML = rows.join('') || '<p class="empty">لا يوجد طلاب</p>';
  },
  async changeGrade(id) {
    const g = prompt('رقم الصف الجديد:\n5 = الثاني الإعدادي\n1 = الأول الثانوي\n2 = الثاني الثانوي\n3 = الثالث الثانوي');
    if (!g || !GRADES[g]) return toast('⚠️ رقم صف غير صحيح', true);
    await db.ref(`students/${id}/grade`).set(g); toast('✅ تم تغيير الصف');
  },
  async block(id) { const b = !!this.data[id].isBlocked; await db.ref(`students/${id}/isBlocked`).set(!b); toast(b ? '✅ تم إلغاء الحظر' : '✅ تم الحظر'); },
  async remove(id) { if (confirm('حذف حساب الطالب نهائياً؟')) { await db.ref('students/' + id).remove(); toast('✅ تم الحذف'); } },
  async viewExams(id) {
    const snap = (await db.ref('studentAttempts').orderByChild('studentId').equalTo(id).once('value')).val();
    const s = this.data[id] || {};
    if (!snap) return toast(`${s.fullName} لم يمتحن أي امتحان بعد`);
    const list = Object.keys(snap).map(k => ({ id: k, ...snap[k] })).sort((a, b) => b.timestamp - a.timestamp);
    list.forEach(a => this.att[a.id] = a);
    modal(`<h3>امتحانات: ${esc(s.fullName)} (${list.length})</h3><table style="width:100%;border-collapse:collapse">
      <tr><th>الدرس</th><th>الدرجة</th><th>النسبة</th><th>التاريخ</th><th></th></tr>${list.map(a => `<tr style="border-top:1px solid var(--line)">
      <td>${esc(a.lessonName)}</td><td>${a.score}/${a.totalQuestions}</td>
      <td style="color:${a.percentage >= 50 ? 'var(--ok)' : 'var(--bad)'}">${a.percentage}%</td>
      <td>${new Date(a.timestamp).toLocaleDateString('ar-EG')}</td>
      <td><button class="btn sm ok" onclick="Reports.sendOne('${a.id}')">واتساب</button></td></tr>`).join('')}</table>`);
  }
};
App.register(Students);
