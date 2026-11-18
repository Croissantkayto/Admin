// الوحدات / الكورسات
const Units = {
  id: 'units', title: 'الوحدات', icon: '🗂️', data: {}, editing: null,
  html: `
    <div class="card"><h3 id="uTitle">إضافة وحدة / كورس</h3>
      <input id="uName" placeholder="اسم الوحدة">
      <div class="grid"><input id="uTerm" list="termList" placeholder="الفصل (الفصل الأول)"><datalist id="termList"><option value="الفصل الأول"><option value="الفصل الثاني"></datalist>
        <select id="uGrade"><option value="">كل الصفوف</option>${gradeOptions()}</select><input type="number" id="uOrder" value="1" min="0" placeholder="الترتيب"></div>
      <input type="file" id="uFile" accept="image/*"><input id="uImg" placeholder="أو الصق رابط صورة">
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="uPub" checked style="width:auto"> منشورة</label>
      <button class="btn ok full" id="uSave" onclick="Units.save()">حفظ الوحدة</button>
      <button class="btn line full hidden" id="uCancel" onclick="Units.reset()">إلغاء التعديل</button></div>
    <div class="card"><h3>📋 الوحدات</h3><div id="uList"></div></div>`,
  init() {
    db.ref('units').on('value', (s) => { this.data = s.val() || {}; this.render(); Lessons.render(); Lessons.fillUnitSelect(); });
  },
  sorted() { return Object.keys(this.data).map(id => ({ id, ...this.data[id] })).sort((a, b) => (a.order || 0) - (b.order || 0)); },
  options(grade, sel) {
    return this.sorted().filter(u => !u.grade || u.grade === grade)
      .map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc((u.term ? u.term + ' - ' : '') + u.name)}</option>`).join('');
  },
  render() {
    $('uList').innerHTML = this.sorted().map(u => {
      const n = Object.values(Lessons.data).filter(l => l.unitId === u.id).length, pub = u.isPublished !== false;
      return `<div class="item"><div class="row">${u.image ? `<img src="${esc(u.image)}" style="width:70px;height:52px;object-fit:cover;border-radius:8px">` : ''}
        <div><strong>${esc(u.name)}</strong><div class="meta">${u.term ? '📅 ' + esc(u.term) + ' • ' : ''}${GRADES[u.grade] || 'كل الصفوف'} • ترتيب ${u.order || 0} • ${n} درس
        <span class="badge ${pub ? 'on' : 'off'}">${pub ? 'منشورة' : 'مخفية'}</span></div></div></div>
        <div class="row"><button class="btn sm line" onclick="Units.edit('${u.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn sm warn" onclick="Units.toggle('${u.id}')">${pub ? 'إخفاء' : 'نشر'}</button>
        <button class="btn sm bad" onclick="Units.remove('${u.id}')"><i class="fas fa-trash"></i></button></div></div>`;
    }).join('') || '<p class="empty">لا توجد وحدات (الطلاب يشوفوا الدروس مباشرة لحد ما تضيف أول وحدة)</p>';
  },
  reset() {
    this.editing = null; ['uName', 'uTerm', 'uImg'].forEach(i => $(i).value = ''); $('uFile').value = '';
    $('uGrade').value = ''; $('uOrder').value = 1; $('uPub').checked = true;
    $('uTitle').textContent = 'إضافة وحدة / كورس'; $('uCancel').classList.add('hidden');
  },
  async save() {
    const name = $('uName').value.trim(); if (!name) return toast('⚠️ أدخل اسم الوحدة', true);
    try {
      let image = $('uImg').value.trim(), f = $('uFile').files[0];
      if (f) { toast('⏳ جاري رفع الصورة...'); image = await uploadImage(f); }
      const d = { name, term: $('uTerm').value.trim(), grade: $('uGrade').value, order: parseInt($('uOrder').value) || 0, image: image || '', isPublished: $('uPub').checked };
      if (this.editing) await db.ref('units/' + this.editing).update(d); else await db.ref('units').push({ ...d, createdAt: Date.now() });
      this.reset(); toast('✅ تم الحفظ');
    } catch (e) { toast('❌ ' + e.message, true); }
  },
  edit(id) {
    const u = this.data[id]; this.editing = id;
    $('uName').value = u.name || ''; $('uTerm').value = u.term || ''; $('uGrade').value = u.grade || ''; $('uOrder').value = u.order || 0;
    $('uImg').value = u.image || ''; $('uPub').checked = u.isPublished !== false; $('uFile').value = '';
    $('uTitle').textContent = 'تعديل الوحدة'; $('uCancel').classList.remove('hidden'); scrollTo({ top: 0, behavior: 'smooth' });
  },
  toggle(id) { return db.ref(`units/${id}/isPublished`).set(this.data[id].isPublished === false); },
  async remove(id) {
    if (!confirm('حذف الوحدة؟ دروسها هتفضل موجودة وتظهر للطلاب تحت "دروس أخرى".')) return;
    const up = { ['units/' + id]: null };
    Object.keys(Lessons.data).forEach(l => { if (Lessons.data[l].unitId === id) up[`lessons/${l}/unitId`] = null; });
    await db.ref().update(up);
  }
};
App.register(Units);
