// سيرفر واتساب أوتوماتيك — بيقرا طابور الرسائل من Firebase ويبعتها، وبيجهّز التقارير لوحده
import fs from 'fs';
import admin from 'firebase-admin';
import pino from 'pino';
import * as B from '@whiskeysockets/baileys';

const W = { ...(B.default && typeof B.default === 'object' ? B.default : {}), ...B };
const makeWASocket = typeof B.default === 'function' ? B.default : (typeof B.default?.default === 'function' ? B.default.default : W.makeWASocket);
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = W;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync('./serviceAccount.json', 'utf8'))),
  databaseURL: 'https://e-learning-18a52-default-rtdb.europe-west1.firebasedatabase.app'
});
const db = admin.database();
const val = async (p) => (await db.ref(p).once('value')).val() || {};
const exists = async (p) => (await db.ref(p).once('value')).exists();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (Math.max(b, a) - a);
const status = (o) => db.ref('waStatus').update({ ...o, updatedAt: Date.now() });
const DEF = { enabled: false, autoExam: true, autoWeekly: false, weeklyDay: 5, weeklyHour: 18, minDelay: 8, maxDelay: 20, dailyCap: 150 };
let settings = { ...DEF }, sock = null, ready = false;

// ---------------- الاتصال بواتساب ----------------
async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), browser: ['Alebour', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) await status({ state: 'qr', qr });
    if (connection === 'open') { ready = true; await status({ state: 'connected', qr: null, note: null }); console.log('✅ واتساب متصل'); }
    if (connection === 'close') {
      ready = false;
      if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
        fs.rmSync('./auth', { recursive: true, force: true }); await status({ state: 'loggedout', qr: null });
      } else await status({ state: 'reconnecting' });
      setTimeout(connect, 3000);
    }
  });
}
const phoneOf = (raw) => {
  let p = String(raw ?? '').replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('20')) return p; if (p.startsWith('0')) return '20' + p.slice(1);
  return (p.length === 10 && p[0] === '1') ? '20' + p : p;
};
async function sendText(phone, text) {
  const [r] = await sock.onWhatsApp(phone + '@s.whatsapp.net');
  if (!r?.exists) throw new Error('الرقم ليس على واتساب');
  await sock.sendPresenceUpdate('composing', r.jid); await sleep(rnd(1200, 3500));
  await sock.sendMessage(r.jid, { text }); await sock.sendPresenceUpdate('paused', r.jid);
}

// ---------------- طابور الإرسال ----------------
let busy = false;
async function pump() {
  if (busy || !ready) return; busy = true;
  try {
    const day = new Date().toISOString().slice(0, 10), S = settings;
    const snap = await db.ref('waQueue').orderByChild('status').equalTo('pending').limitToFirst(25).once('value');
    for (const [k, it] of Object.entries(snap.val() || {})) {
      if (!ready) break;
      if (((await val('waStats/' + day)).count || 0) >= S.dailyCap) { await status({ note: 'تم الوصول للحد اليومي، هيكمل بكرة' }); break; }
      await db.ref('waQueue/' + k).update({ status: 'sending' });
      try {
        await sendText(it.phone, it.message);
        await db.ref('waQueue/' + k).update({ status: 'sent', sentAt: Date.now(), error: null });
        await db.ref(`waStats/${day}/count`).transaction(n => (n || 0) + 1);
      } catch (e) { await db.ref('waQueue/' + k).update({ status: 'failed', error: String(e.message || e) }); }
      await sleep(rnd(+S.minDelay, +S.maxDelay) * 1000);
    }
  } catch (e) { console.error('pump', e.message); } finally { busy = false; }
}

// ---------------- نصوص التقارير ----------------
const HEAD = 'السلام عليكم،\nمع حضرتك متابعة أ. أحمد رزق - مدرس التاريخ';
const latest = (A, sid, lid, i) => A.filter(a => a.studentId === sid && a.lessonId === lid && +a.examIndex === +i).sort((p, q) => q.timestamp - p.timestamp)[0];
const examMsg = (s, l, e, a) => a
  ? `${HEAD}\n\nتقرير عن الطالب: ${s.fullName}\n📖 الدرس: ${l.name}\n📝 الامتحان: ${e.name}\nالدرجة: ${a.score} من ${a.totalQuestions} (${a.percentage}%)\n\nمنصة العبور.`
  : `${HEAD}\n\nنود إعلامكم بأن الطالب: ${s.fullName}\nلم يحضر : ${e.name}\nمن درس: ${l.name}\n\nمنصة العبور.`;
function generalMsg(s, id, A, gl, total) {
  const last = {}; A.forEach(a => { if (a.studentId === id) { const k = a.lessonId + '_' + a.examIndex; if (!last[k] || a.timestamp > last[k].timestamp) last[k] = a; } });
  let d = '📋 تفاصيل المنهج:\n\n', n = 0, sum = 0;
  gl.forEach(l => { if (!(l.exams || []).length) return; d += `📖 الدرس: ${l.name}\n`;
    l.exams.forEach((e, i) => { const m = last[l.id + '_' + i];
      if (m) { d += `   - ${e.name}: ${m.score} من ${m.totalQuestions} (${m.percentage}%)\n`; n++; sum += m.percentage; } else d += `   - ${e.name}: ⚠️ لم يحضر\n`; });
    d += '\n'; });
  const rate = total ? Math.round(n / total * 100) : 0, avg = n ? Math.round(sum / n) : 0;
  const tip = !n ? 'ياريت نحفزه إنه يبدأ يحضر الامتحانات عشان نقدر نتابع مستواه.' : rate < 90 ? 'ننصحه بالالتزام أكثر وحضور جميع الامتحانات، لأن الالتزام هو أساس النجاح.'
    : avg >= 90 ? 'مبارك عليه! وإن شاء الله يكمل بنفس التفوق والالتزام.' : 'التزامه ممتاز، وياريت نشد عليه شوية في المذاكرة عشان يوصل لأفضل نتيجة.';
  return `${HEAD}\n\nالتقرير العام للطالب: ${s.fullName}\n\n${d}📊 إجمالي الامتحانات اللي حضرها: ${n} من أصل ${total}\n✅ نسبة الحضور (الالتزام): ${rate}%\n📈 متوسط الدرجات: ${avg}%\n\n${tip}\n\nمنصة العبور.`;
}
async function enqueue(list, type) {
  const up = {};
  list.forEach(x => {
    const p = phoneOf(x.s.parentPhone); if (!/^\d{10,15}$/.test(p)) return;
    up[db.ref('waQueue').push().key] = { phone: p, message: x.m, name: x.s.fullName, studentId: x.id, type, status: 'pending', createdAt: Date.now() };
  });
  if (Object.keys(up).length) await db.ref('waQueue').update(up);
  console.log(`📥 ${type}: ${Object.keys(up).length} رسالة`);
}

// ---------------- المهام التلقائية (كل دقيقة) ----------------
async function tick() {
  try {
    settings = { ...DEF, ...(await val('waSettings')) };
    await db.ref('waStatus').update({ heartbeat: Date.now() });
    const S = settings; if (!S.enabled) return;
    const now = Date.now(); let L = null, ST = null, A = null;
    const load = async () => { L = L || await val('lessons'); ST = ST || await val('students'); A = A || Object.values(await val('studentAttempts')); };

    if (S.autoExam) {   // بعد موعد غلق الامتحان بـ 5 دقايق
      L = await val('lessons');
      for (const [lid, l] of Object.entries(L)) {
        if (!l.isPublished) continue;
        for (const [i, e] of (l.exams || []).entries()) {
          if (!e.closeAt || e.closeAt + 300000 > now || e.closeAt < now - 7 * 864e5) continue;
          const key = `exam_${lid}_${i}_${e.closeAt}`;
          if (await exists('waJobs/' + key)) continue;
          await db.ref('waJobs/' + key).set(now); await load();
          await enqueue(Object.entries(ST).filter(([, s]) => s.grade === l.grade && s.parentPhone && !s.isBlocked)
            .map(([id, s]) => ({ s, id, m: examMsg(s, l, e, latest(A, id, lid, i)) })), 'auto-exam');
        }
      }
    }
    if (S.autoWeekly) {
      const c = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
      const key = `weekly_${c.getFullYear()}-${c.getMonth() + 1}-${c.getDate()}`;
      if (c.getDay() === +S.weeklyDay && c.getHours() >= +S.weeklyHour && !(await exists('waJobs/' + key))) {
        await db.ref('waJobs/' + key).set(now); L = null; await load();
        for (const g of Object.keys({ 5: 1, 1: 1, 2: 1, 3: 1 })) {
          const gl = Object.keys(L).filter(i => L[i].grade === g && L[i].isPublished).map(i => ({ id: i, ...L[i] }));
          const total = gl.reduce((s, l) => s + (l.exams || []).length, 0);
          await enqueue(Object.entries(ST).filter(([, s]) => s.grade === g && s.parentPhone && !s.isBlocked)
            .map(([id, s]) => ({ s, id, m: generalMsg(s, id, A, gl, total) })), 'auto-weekly');
        }
      }
    }
  } catch (e) { console.error('tick', e.message); }
}

// ---------------- تشغيل ----------------
process.on('unhandledRejection', (e) => console.error('unhandled', e?.message || e));
const stuck = await db.ref('waQueue').orderByChild('status').equalTo('sending').once('value');
for (const k of Object.keys(stuck.val() || {})) await db.ref(`waQueue/${k}/status`).set('pending');
await status({ state: 'starting' });
await connect();
setInterval(pump, 5000); setInterval(tick, 60000); tick();
