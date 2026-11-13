const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const money = (n) => `$${n.toFixed(2)}`;

async function api(url, options = {}) {
  const init = { method: options.method ?? 'GET', headers: { 'Content-Type': 'application/json' } };
  if (options.body) init.body = JSON.stringify(options.body);
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function el(tag, text, testId) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (testId) node.dataset.testid = testId;
  return node;
}

// ---- products and search ----
let searchTimer;

async function loadProducts(query = '') {
  const { data } = await api(`/api/products?q=${encodeURIComponent(query)}`);
  const list = $('results');
  list.replaceChildren();
  for (const product of data) {
    const li = el('li', undefined, 'result');
    li.append(el('span', product.name), document.createTextNode(' '), el('span', money(product.price)), document.createTextNode(' '));
    const button = el('button', 'Add to cart', 'add-to-cart');
    button.type = 'button';
    button.addEventListener('click', () => addToCart(product.id));
    li.append(button);
    list.append(li);
  }
  $('empty-state').hidden = data.length > 0;
}

// Search is debounced by 400 ms, so results lag behind typing.
$('search-input').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadProducts(event.target.value), 400);
});

// ---- cart ----
function renderItems(cart) {
  const list = $('cart-items');
  list.replaceChildren();
  for (const item of cart.items) {
    const li = el('li', undefined, 'cart-item');
    li.append(el('span', `${item.name} × ${item.qty}`), document.createTextNode(' '));
    const remove = el('button', 'Remove', 'remove-item');
    remove.type = 'button';
    remove.addEventListener('click', () => removeFromCart(item.id));
    li.append(remove);
    list.append(li);
  }
}

function renderTotals(cart) {
  $('cart-total').textContent = money(cart.total);
}

async function refreshCart() {
  const { data } = await api('/api/cart');
  renderItems(data);
  renderTotals(data);
}

async function addToCart(productId) {
  const { data } = await api('/api/cart', { method: 'POST', body: { productId } });
  renderItems(data);
  renderTotals(data);
}

async function removeFromCart(productId) {
  const { data } = await api(`/api/cart/${productId}`, { method: 'DELETE' });
  // Seeded defect PB-002: totals are not refreshed after an item is removed.
  renderItems(data);
}

$('apply-discount').addEventListener('click', async () => {
  const { ok, data } = await api('/api/cart/discount', { method: 'POST', body: { code: $('discount-code').value } });
  $('discount-message').textContent = ok ? 'Discount applied' : data.error;
  if (ok) renderTotals(data);
});

// ---- auth ----
async function refreshAuth() {
  const { ok, data } = await api('/api/me');
  $('user-name').textContent = ok ? data.email : '';
  $('user-name').hidden = !ok;
  $('logout-button').hidden = !ok;
  document.getElementById('login-form').hidden = ok;
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { ok, data } = await api('/api/login', {
    method: 'POST',
    body: { email: $('login-email').value, password: $('login-password').value },
  });
  $('login-error').textContent = ok ? '' : data.error;
  if (ok) await refreshAuth();
});

$('logout-button').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  await refreshAuth();
});

// ---- checkout ----
document.getElementById('checkout').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { ok, data } = await api('/api/checkout', { method: 'POST', body: { address: $('shipping-address').value } });
  $('checkout-error').textContent = ok ? '' : data.error;
  if (ok) {
    $('order-id').textContent = data.orderId;
    $('order-confirmation').hidden = false;
    await refreshCart();
  }
});

loadProducts();
refreshCart();
refreshAuth();
