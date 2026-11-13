'use strict';
// Demo shop used as the application under test. No dependencies: `node app/server.js`.
// It contains seeded defects so the triage lab has real failures to analyse.
// Answer key: triage/labels.json (instructors: keep it away from learners until after the lab).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHIPPING = 5;
const MAX_FAILED_LOGINS = 3;
const DISCOUNT_CODES = { SAVE10: 0.1 };
const PRODUCTS = [
  { id: 1, name: 'Mechanical Keyboard', price: 60 },
  { id: 2, name: 'Wireless Mouse', price: 25 },
  { id: 3, name: 'USB-C Hub', price: 40 },
];

let users;
let sessions;
let orderSeq;
resetState();

function seedUsers() {
  return new Map([['alice@example.com', { password: 'password123', failedLogins: 0 }]]);
}

function resetState() {
  users = seedUsers();
  sessions = new Map();
  orderSeq = 1000;
}

const round2 = (n) => Math.round(n * 100) / 100;

function getSession(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie ?? '').split(';').filter(Boolean).map((c) => c.trim().split('=')),
  );
  let id = cookies.sid;
  if (!id || !sessions.has(id)) {
    id = crypto.randomUUID();
    sessions.set(id, { userId: null, cart: [], discount: null });
    res.setHeader('Set-Cookie', `sid=${id}; Path=/; HttpOnly; SameSite=Lax`);
  }
  return sessions.get(id);
}

function cartView(session) {
  const items = session.cart.map((line) => {
    const p = PRODUCTS.find((x) => x.id === line.productId);
    return { id: p.id, name: p.name, price: p.price, qty: line.qty };
  });
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const rate = session.discount ? DISCOUNT_CODES[session.discount] : 0;
  // Seeded defect PB-001: the discount is applied to subtotal + shipping instead of the subtotal.
  const total = round2((subtotal + SHIPPING) * (1 - rate));
  return { items, subtotal, shipping: SHIPPING, discount: session.discount, total };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true });
  if (method === 'POST' && pathname === '/api/reset') {
    resetState();
    return json(res, 200, { ok: true });
  }

  const session = getSession(req, res);
  const body = method === 'POST' ? await readJson(req) : {};

  if (method === 'GET' && pathname === '/api/products') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    return json(res, 200, PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)));
  }

  if (method === 'POST' && pathname === '/api/users') {
    const { email, password } = body;
    if (!email || !password) return json(res, 400, { error: 'Email and password are required' });
    if (users.has(email)) return json(res, 409, { error: 'User already exists' });
    users.set(email, { password, failedLogins: 0 });
    return json(res, 201, { email });
  }

  if (method === 'POST' && pathname === '/api/login') {
    const { email, password } = body;
    const user = users.get(email);
    if (!user) return json(res, 401, { error: 'Invalid email or password' });
    if (user.failedLogins >= MAX_FAILED_LOGINS) {
      return json(res, 423, { error: 'Account locked after too many failed attempts' });
    }
    if (user.password !== password) {
      user.failedLogins += 1;
      return json(res, 401, { error: 'Invalid email or password' });
    }
    user.failedLogins = 0;
    session.userId = email;
    return json(res, 200, { email });
  }

  if (method === 'POST' && pathname === '/api/logout') {
    session.userId = null;
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    return session.userId
      ? json(res, 200, { email: session.userId })
      : json(res, 401, { error: 'Not logged in' });
  }

  if (method === 'GET' && pathname === '/api/cart') return json(res, 200, cartView(session));

  if (method === 'POST' && pathname === '/api/cart') {
    const product = PRODUCTS.find((p) => p.id === Number(body.productId));
    if (!product) return json(res, 404, { error: 'Unknown product' });
    const line = session.cart.find((l) => l.productId === product.id);
    if (line) line.qty += 1;
    else session.cart.push({ productId: product.id, qty: 1 });
    return json(res, 200, cartView(session));
  }

  const removeMatch = pathname.match(/^\/api\/cart\/(\d+)$/);
  if (method === 'DELETE' && removeMatch) {
    session.cart = session.cart.filter((l) => l.productId !== Number(removeMatch[1]));
    return json(res, 200, cartView(session));
  }

  if (method === 'POST' && pathname === '/api/cart/discount') {
    const code = String(body.code ?? '').trim().toUpperCase();
    if (!DISCOUNT_CODES[code]) return json(res, 400, { error: 'Invalid discount code' });
    session.discount = code;
    return json(res, 200, cartView(session));
  }

  if (method === 'POST' && pathname === '/api/checkout') {
    if (!session.userId) return json(res, 401, { error: 'Please log in to check out' });
    if (session.cart.length === 0) return json(res, 400, { error: 'Your cart is empty' });
    if (!String(body.address ?? '').trim()) return json(res, 400, { error: 'Shipping address is required' });
    const orderId = `ORD-${++orderSeq}`;
    session.cart = [];
    session.discount = null;
    return json(res, 201, { orderId });
  }

  return json(res, 404, { error: 'Not found' });
}

function serveStatic(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] ?? 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => console.log(`Demo shop running at http://localhost:${PORT}`));
