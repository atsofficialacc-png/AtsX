const express = require('express');
const fs = require('fs');
const path = require('path');

// Minimal .env loader (no extra dependency required)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || '').trim();
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || '').trim();
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], orders: [], botOffset: 0 }, null, 2));
}

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [], orders: [], botOffset: 0 }; }
}
function writeDb(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function normalizeUser(u = {}) {
  return {
    id: String(u.id || u.accountID || ''),
    accountID: String(u.accountID || u.id || ''),
    name: String(u.name || u.username || 'User'),
    phone: String(u.phone || ''),
    password: String(u.password || ''),
    pin: String(u.pin || ''),
    balance: Number(u.balance || 0),
    avatar: u.avatar || 'Wallet.jpg',
    bgImage: u.bgImage || '',
    isBanned: Boolean(u.isBanned),
    devices: Array.isArray(u.devices) ? u.devices : []
  };
}
function upsertUser(db, incoming) {
  const u = normalizeUser(incoming);
  if (!u.phone && !u.id) return null;
  let i = db.users.findIndex(x => (u.phone && x.phone === u.phone) || (u.id && x.id === u.id));
  if (i < 0) { db.users.push(u); return u; }
  // Never overwrite a newer server balance with a stale browser balance.
  const existing = db.users[i];
  const merged = { ...existing, ...u, balance: Number(existing.balance || 0) };
  db.users[i] = merged;
  return merged;
}
function findUser(db, phone, id) {
  return db.users.find(u => (phone && u.phone === phone) || (id && u.id === id));
}

function requireAdminApi(req, res, next) {
  const key = String(req.headers['x-atsx-admin-key'] || '');
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) return res.status(401).json({ok:false,error:'Unauthorized'});
  next();
}

app.use(express.json({ limit: '12mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/api/health', (req, res) => res.json({ ok: true, botConfigured: Boolean(BOT_TOKEN), adminConfigured: Boolean(ADMIN_CHAT_ID) }));

app.post('/api/sync-users', (req, res) => {
  const incoming = Array.isArray(req.body?.users) ? req.body.users : [];
  const db = readDb();
  for (const u of incoming) upsertUser(db, u);
  writeDb(db);
  res.json({ ok: true, count: db.users.length });
});

app.get('/api/users', (req, res) => {
  const db = readDb();
  res.json({ ok: true, users: db.users });
});

app.get('/api/user', (req, res) => {
  const db = readDb();
  const user = findUser(db, String(req.query.phone || ''), String(req.query.id || ''));
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  res.json({ ok: true, user });
});

app.post('/api/orders/:id/approve', requireAdminApi, (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ok:false,error:'Order not found'});
  if (order.status !== 'Pending') return res.status(400).json({ok:false,error:`Already ${order.status}`});
  order.status = 'Approved';
  const user = findUser(db, String(order.userPhone), '');
  if (user) user.balance = Number(user.balance || 0) + Number(order.amount || 0);
  writeDb(db);
  res.json({ok:true, order, user:user || null});
});

app.post('/api/orders/:id/reject', requireAdminApi, (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ok:false,error:'Order not found'});
  if (order.status !== 'Pending') return res.status(400).json({ok:false,error:`Already ${order.status}`});
  order.status = 'Rejected';
  writeDb(db);
  res.json({ok:true, order});
});

app.delete('/api/orders/:id', requireAdminApi, (req, res) => {
  const db = readDb();
  db.orders = db.orders.filter(o => String(o.id) !== String(req.params.id));
  writeDb(db);
  res.json({ok:true});
});

app.get('/api/orders', (req, res) => {
  const db = readDb();
  const phone = String(req.query.phone || '');
  const orders = phone ? db.orders.filter(o => String(o.userPhone) === phone) : db.orders;
  res.json({ ok: true, orders });
});

app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body?.order;
    const user = req.body?.user;
    if (!order || !Number(order.amount) || !user) return res.status(400).json({ ok: false, error: 'Invalid order' });

    const db = readDb();
    upsertUser(db, user);
    const newOrder = {
      id: String(order.id || ('TP' + Date.now())),
      userName: String(order.userName || user.name || 'User'),
      userPhone: String(order.userPhone || user.phone || ''),
      amount: Number(order.amount),
      image: String(order.image || ''),
      date: String(order.date || new Date().toLocaleString('en-GB')),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    db.orders = [newOrder, ...db.orders.filter(o => String(o.id) !== newOrder.id)].slice(0, 100);
    writeDb(db);

    await notifyAdmin(newOrder);
    res.json({ ok: true, order: newOrder });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

async function telegram(method, body) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is not configured');
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return r.json();
}

async function notifyAdmin(order) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  const text = [
    '📥 AtsX New Topup Order',
    `🆔 ${order.id}`,
    `👤 ${order.userName}`,
    `📱 ${order.userPhone}`,
    `💰 ${Number(order.amount).toLocaleString()} MMK`,
    `🕒 ${order.date}`,
    '',
    'Approve / Reject လုပ်ရန် အောက်က ခလုတ်ကိုနှိပ်ပါ။'
  ].join('\n');
  await telegram('sendMessage', {
    chat_id: ADMIN_CHAT_ID,
    text,
    reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: `approve:${order.id}` },
      { text: '❌ Reject', callback_data: `reject:${order.id}` }
    ]] }
  });
  if (order.image && order.image.startsWith('data:image/')) {
    const [meta, b64] = order.image.split(',');
    const mime = (meta.match(/data:([^;]+)/) || [,'image/jpeg'])[1];
    const buf = Buffer.from(b64, 'base64');
    const form = new FormData();
    form.append('chat_id', ADMIN_CHAT_ID);
    form.append('caption', `${order.id} • ${Number(order.amount).toLocaleString()} MMK`);
    form.append('photo', new Blob([buf], { type: mime }), 'slip.jpg');
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  }
}

async function answerCallback(id, text) {
  try { await telegram('answerCallbackQuery', { callback_query_id: id, text, show_alert: false }); } catch {}
}

async function handleUpdate(update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = String(cb.message?.chat?.id || '');
    if (!ADMIN_CHAT_ID || chatId !== ADMIN_CHAT_ID) {
      return answerCallback(cb.id, 'Not authorized');
    }
    const [action, orderId] = String(cb.data || '').split(':');
    if (!['approve', 'reject'].includes(action) || !orderId) return answerCallback(cb.id, 'Invalid action');
    const db = readDb();
    const order = db.orders.find(o => String(o.id) === orderId);
    if (!order) return answerCallback(cb.id, 'Order not found');
    if (order.status !== 'Pending') return answerCallback(cb.id, `Already ${order.status}`);

    if (action === 'approve') {
      order.status = 'Approved';
      const user = findUser(db, String(order.userPhone), '');
      if (user) user.balance = Number(user.balance || 0) + Number(order.amount || 0);
      writeDb(db);
      await answerCallback(cb.id, 'Approved ✅');
      await telegram('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(()=>{});
      await telegram('sendMessage', { chat_id: chatId, text: `✅ Approved\n${order.id}\n💰 ${Number(order.amount).toLocaleString()} MMK\n👤 ${order.userName}` }).catch(()=>{});
    } else {
      order.status = 'Rejected';
      writeDb(db);
      await answerCallback(cb.id, 'Rejected ❌');
      await telegram('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(()=>{});
      await telegram('sendMessage', { chat_id: chatId, text: `❌ Rejected\n${order.id}\n💰 ${Number(order.amount).toLocaleString()} MMK\n👤 ${order.userName}` }).catch(()=>{});
    }
    return;
  }

  if (update.message) {
    const chatId = String(update.message.chat?.id || '');
    const text = String(update.message.text || '').trim();
    if (text === '/id') {
      if (BOT_TOKEN) await telegram('sendMessage', { chat_id: chatId, text: `Your Telegram chat ID is: ${chatId}` }).catch(()=>{});
    } else if (text === '/start' || text === '/help') {
      const msg = (ADMIN_CHAT_ID && chatId === ADMIN_CHAT_ID)
        ? 'AtsX Bot Admin\n\n📥 Topup order တွေကို ဒီမှာရပြီး Approve / Reject လုပ်နိုင်ပါတယ်။'
        : 'AtsX Bot is online. Admin chat ID မသတ်မှတ်ထားသေးပါက server .env ထဲမှာ ADMIN_CHAT_ID ထည့်ပါ။';
      if (BOT_TOKEN) await telegram('sendMessage', { chat_id: chatId, text: msg }).catch(()=>{});
    }
  }
}

let polling = false;
async function pollBot() {
  if (!BOT_TOKEN || polling) return;
  polling = true;
  try {
    const db = readDb();
    const r = await telegram('getUpdates', { offset: Number(db.botOffset || 0), timeout: 25, allowed_updates: ['message', 'callback_query'] });
    if (r.ok && Array.isArray(r.result) && r.result.length) {
      for (const update of r.result) {
        await handleUpdate(update);
        db.botOffset = Number(update.update_id) + 1;
      }
      writeDb(db);
    }
  } catch (e) { console.error('Telegram polling:', e.message); }
  polling = false;
  setTimeout(pollBot, 1000);
}

app.listen(PORT, async () => {
  console.log(`AtsX server running on http://localhost:${PORT}`);
  if (BOT_TOKEN) { try { await telegram('deleteWebhook', { drop_pending_updates: false }); } catch(e) {} }
  if (!BOT_TOKEN) console.log('BOT_TOKEN missing');
  if (!ADMIN_CHAT_ID) console.log('ADMIN_CHAT_ID missing');
  pollBot();
});
