// دخول حقيقي عبر Firebase Authentication (بدل كلمة سر مكتوبة في الكود)
auth.onAuthStateChanged((u) => {
  $('loginPage').classList.toggle('hidden', !!u);
  $('adminPanel').classList.toggle('hidden', !u);
  if (u) { App.mount(); Grading.process(); }
});
async function login() {
  const err = $('loginError');
  try { await auth.signInWithEmailAndPassword($('email').value.trim(), $('password').value); err.classList.add('hidden'); }
  catch (e) { err.textContent = '❌ بيانات الدخول غير صحيحة'; err.classList.remove('hidden'); }
}
const logout = () => auth.signOut();
