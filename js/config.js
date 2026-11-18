// الإعدادات — ملاحظة: مفتاح imgbb الأفضل نقله لـ Cloudflare Worker مع الوقت
firebase.initializeApp({
  apiKey: "AIzaSyCi3UL4g-4mKpBGEmccI6egsfgSCgwgaqA",
  authDomain: "e-learning-18a52.firebaseapp.com",
  databaseURL: "https://e-learning-18a52-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "e-learning-18a52",
  storageBucket: "e-learning-18a52.firebasestorage.app",
  appId: "1:59167845805:web:b24d1a134f9dd244ec8524"
});
const db = firebase.database();
const auth = firebase.auth();
const CFG = {
  IMGBB_KEY: "e0662017057c216bb6f032a5d15c45db",
  GRADER_URL: "https://super-paper-3699.croissant2009a.workers.dev",
  WA_URL: "http://127.0.0.1:3000"
};
