async function api(path, opts){
  opts = opts || {};
  opts.headers = opts.headers || {};
  const token = localStorage.getItem('token');0
  if (token && !opts.headers.Authorization) opts.headers.Authorization = 'Bearer ' + token;
  const res = await fetch(path, opts);
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (!res.ok) throw { status: res.status, body: data };
  return data;
}

function el(selector){ return document.querySelector(selector); }
function normalizeText(str){ return String(str || '').toLowerCase().trim(); }

let currentUser = null;
let pendingDeleteProductId = null;
let pendingStockProductId = null;
let pendingDeleteOrderId = null;
let pendingEditOrderId = null;

function saveAuth(token, user){
  currentUser = user || {};
  currentUser.isAdmin = !!currentUser.isAdmin;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(currentUser));
  renderAuthUI();
}

function clearAuth(){
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  renderAuthUI();0
  window.location.href = '/';
}

function decodeJwtPayload(token){
  try {
    const payloadPart = token.split('.')[1] || '';
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (err) {
    return null;
  }
}

function loadAuthFromStorage(){
  const t = localStorage.getItem('token');
  const u = localStorage.getItem('user');
  const payload = t ? decodeJwtPayload(t) : null;
  const isExpired = payload && payload.exp ? (payload.exp * 1000 < Date.now()) : false;

  if (isExpired) {
    clearAuth();
    return;
  }

  if (t && u) {
    try {
      currentUser = JSON.parse(u);
    } catch(e){ currentUser = null }
    if (currentUser) {
      const payloadIsAdmin = payload && typeof payload.isAdmin !== 'undefined' ? !!payload.isAdmin : undefined;
      if (typeof currentUser.isAdmin === 'undefined') {
        currentUser.isAdmin = payloadIsAdmin || false;
      } else {
        currentUser.isAdmin = !!currentUser.isAdmin;
      }
      if (!currentUser._id && currentUser.id) {
        currentUser._id = currentUser.id;
      }
      if (!currentUser._id && payload) {
        currentUser._id = payload._id || payload.id || payload.sub || currentUser._id;
      }
    }
  } else if (t) {
    const id = payload ? (payload._id || payload.id || payload.sub || null) : null;
    const nombre = payload ? (payload.nombre || payload.name || payload.username || null) : null;
    const email = payload ? payload.email : null;
    const isAdmin = payload && typeof payload.isAdmin !== 'undefined' ? !!payload.isAdmin : false;
    if (id || nombre || email) {
      currentUser = { _id: id, nombre, email, isAdmin };
    } else {
      currentUser = null;
    }
  } else currentUser = null;
}

function renderAuthUI(){
  const area = el('#auth-area');
  if (!area) return;
  area.innerHTML = '';
  
  if (currentUser) {
    // Cart button
    const cartBtn = document.createElement('button');
    cartBtn.id = 'cart-btn';
    cartBtn.type = 'button';
    cartBtn.className = 'btn btn-sm btn-outline-primary auth-action-btn auth-cart-btn';
    cartBtn.innerHTML = 'Carrito <span id="cart-count" class="badge bg-light text-dark ms-2">0</span>';
    cartBtn.addEventListener('click', ()=> openCart());
    area.appendChild(cartBtn);
    
    // User info button with icon
    const userBtn = document.createElement('button');
    userBtn.type = 'button';
    userBtn.className = 'btn btn-sm auth-user-btn auth-user-main';
    userBtn.innerHTML = `<span class="auth-user-icon">👤</span><span class="auth-user-name">${escapeHtml(currentUser.nombre || currentUser.username || currentUser.email)}</span>`;
    userBtn.addEventListener('click', ()=> showModal('editClienteModal'));
    area.appendChild(userBtn);
    
    // Logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn btn-sm btn-outline-secondary auth-action-btn auth-logout-btn';
    logoutBtn.textContent = 'Cerrar sesión';
    logoutBtn.addEventListener('click', ()=> clearAuth());
    area.appendChild(logoutBtn);
  } else {
    // Cart button
    const cartBtn = document.createElement('button');
    cartBtn.id = 'cart-btn';
    cartBtn.type = 'button';
    cartBtn.className = 'btn btn-sm btn-outline-primary auth-action-btn auth-cart-btn';
    cartBtn.innerHTML = 'Carrito <span id="cart-count" class="badge bg-light text-dark ms-2">0</span>';
    cartBtn.addEventListener('click', ()=> openCart());
    area.appendChild(cartBtn);
    
    const loginBtn = document.createElement('button');
    loginBtn.id = 'btn-login';
    loginBtn.type = 'button';
    loginBtn.className = 'btn btn-sm btn-outline-primary auth-action-btn auth-login-btn';
    loginBtn.textContent = 'Iniciar sesión';
    loginBtn.addEventListener('click', ()=> showModal('loginModal'));
    area.appendChild(loginBtn);
    
    const regBtn = document.createElement('button');
    regBtn.id = 'btn-register';
    regBtn.type = 'button';
    regBtn.className = 'btn btn-sm btn-primary auth-action-btn auth-register-btn';
    regBtn.textContent = 'Registrarse';
    regBtn.addEventListener('click', ()=> showModal('registerModal'));
    area.appendChild(regBtn);
  }
  
  updateAdminLinks();
  updateCartBadge();
  initCartButtons();
}

function updateAdminLinks(){
  const productLink = el('#productos-form-link');
  if (productLink) {
    productLink.style.display = (currentUser && currentUser.isAdmin) ? '' : 'none';
  }
  const navClientes = el('#nav-clientes');
  if (navClientes) {
    navClientes.style.display = (currentUser && currentUser.isAdmin) ? '' : 'none';
  }
  const navPedidos = el('#nav-pedidos');
  if (navPedidos) {
    navPedidos.style.display = currentUser ? '' : 'none';
  }
  const adminCards = el('#admin-cards');
  if (adminCards) {
    adminCards.style.display = (currentUser && currentUser.isAdmin) ? '' : 'none';
  }
  const adminSection = el('#administradores');
  if (adminSection) {
    adminSection.style.display = (currentUser && currentUser.isAdmin) ? '' : 'none';
  }
}

// Cart helpers
function getCart(){
  try{ return JSON.parse(localStorage.getItem('cart') || '[]'); }catch(e){ return [] }
}
function saveCart(cart){
  localStorage.setItem('cart', JSON.stringify(cart || []));
  updateCartBadge();
}
function updateCartBadge(){
  const countNode = el('#cart-count');
  if (!countNode) return;
  const cart = getCart();
  const totalItems = cart.reduce((s,i)=>s+Number(i.cantidad||0),0);
  countNode.textContent = totalItems;
}
function openCart(){
  renderCart();
  // open the drawer
  const d = document.getElementById('cartDrawer'); if (!d) return; d.classList.add('open'); d.setAttribute('aria-hidden','false');
}

// visual toast notification
function showToast(msg){
  if (!msg) return;
  let container = document.querySelector('.toast-container');
  if (!container){ container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const t = document.createElement('div'); t.className = 'toast-message'; t.textContent = msg;
  container.appendChild(t);
  // trigger show
  requestAnimationFrame(()=> t.classList.add('show'));
  setTimeout(()=>{
    t.classList.remove('show');
    t.addEventListener('transitionend', ()=> t.remove(), { once:true });
  }, 3000);
}

function initCartButtons(){
  const back = el('#cart-back-home');
  if (back) back.onclick = ()=>{ closeCart(); window.location.href = '/'; };
  const order = el('#cart-order');
  if (order) order.onclick = ()=>{
    const cart = getCart();
    if (!cart || cart.length===0) return alert('El carrito está vacío');
    if (!currentUser) {
      showModal('registerModal');
      return;
    }
    // usuario logueado: ir a crear pedido
    window.location.href = '/formPedidos.html';
  };
  const closeBtn = el('#cart-close'); if (closeBtn) closeBtn.onclick = ()=> closeCart();
}

function closeCart(){
  const d = document.getElementById('cartDrawer'); if (!d) return; d.classList.remove('open'); d.setAttribute('aria-hidden','true');
}
function renderCart(){
  const root = el('#cart-contents'); if(!root) return;
  const cart = getCart();
  if (!cart || cart.length===0){ root.innerHTML = '<div class="empty">No hay productos en el carrito</div>'; el('#cart-total').textContent=''; return }
  root.innerHTML = '';
  const list = document.createElement('div'); list.className='cart-list';
  let total = 0;
  cart.forEach(item=>{
    const row = document.createElement('div'); row.className='cart-row';
    row.innerHTML = `
      <div class="cart-row-left">
        <div class="cart-name">${item.nombre}</div>
        <div class="cart-meta">$${Number(item.precio).toFixed(2)} • Subtotal: $${(item.precio*item.cantidad).toFixed(2)}</div>
      </div>
      <div class="cart-row-right">
        <input type="number" min="1" value="${item.cantidad}" data-id="${item._id}" class="cart-qty" style="width:64px;padding:6px;border-radius:6px;border:1px solid rgba(15,23,42,0.06)">
        <button class="btn btn-sm btn-outline-danger cart-remove" data-id="${item._id}">Eliminar</button>
      </div>
    `;
    list.appendChild(row);
    total += Number(item.precio)*Number(item.cantidad);
  });
  root.appendChild(list);
  el('#cart-total').textContent = `Total: $${total.toFixed(2)}`;
  // update cart buttons and state
  initCartButtons();
  const orderBtn = el('#cart-order');
  if (orderBtn) {
    orderBtn.disabled = cart.length===0;
    orderBtn.textContent = (currentUser ? 'Hacer pedido' : 'Registrarse para hacer pedido');
  }
  // handlers
  root.querySelectorAll('.cart-qty').forEach(inp=> inp.addEventListener('change', (e)=>{
    const id = inp.getAttribute('data-id');
    const val = Number(inp.value) || 1;
    const cart = getCart();
    const it = cart.find(i=>i._id===id);
    if (it){ it.cantidad = val; }
    saveCart(cart);
    renderCart();
  }));
  root.querySelectorAll('.cart-remove').forEach(b=> b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-id');
    const cart = getCart().filter(i=>i._id!==id);
    saveCart(cart);
    renderCart();
  }));
  const clearBtn = el('#cart-clear'); if (clearBtn) { clearBtn.onclick = ()=>{ if(confirm('Vaciar carrito?')){ saveCart([]); renderCart(); }} }
}

function showModal(id, client){
  // Close any other open modals to avoid overlap
  document.querySelectorAll('.modal.show').forEach(openEl=>{
    try{ const inst = bootstrap.Modal.getInstance(openEl); if (inst) inst.hide(); }catch(e){}
  });
  const elModal = document.getElementById(id);
  if (!elModal) return;
  const modal = new bootstrap.Modal(elModal);
  modal.show();
  
  // If it's the edit cliente modal, load the data
  if (id === 'editClienteModal') {
    loadClienteEditData(client);
  }
}

function loadClienteEditData(client){
  const user = client || currentUser || {};
  const idField = el('#edit-cliente-id');
  if (idField) idField.value = client ? (client._id || client.id || '') : (currentUser && (currentUser._id || currentUser.id) || '');
  el('#edit-nombre').value = user.nombre || '';
  el('#edit-username').value = user.username || '';
  el('#edit-email').value = user.email || '';
  el('#edit-telefono').value = user.telefono || '';
  el('#edit-direccion').value = user.direccion || '';
}

async function submitClienteEdit(e){
  e.preventDefault();
  const msg = el('#edit-cliente-msg');
  msg.textContent = '';
  
  const targetId = el('#edit-cliente-id') ? el('#edit-cliente-id').value : null;
  const userId = targetId || (currentUser && (currentUser._id || currentUser.id));
  if (!userId) {
    msg.textContent = 'Error: usuario no identificado';
    return;
  }
  
  const updates = {
    nombre: el('#edit-nombre').value.trim(),
    username: el('#edit-username').value.trim(),
    email: el('#edit-email').value.trim(),
    telefono: el('#edit-telefono').value.trim(),
    direccion: el('#edit-direccion').value.trim()
  };
  
  try {
    const res = await api(`/clientes/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!targetId || targetId === (currentUser && (currentUser._id || currentUser.id))) {
      currentUser = { ...currentUser, ...updates };
      localStorage.setItem('user', JSON.stringify(currentUser));
      renderAuthUI();
    }
    
    msg.textContent = 'Cambios guardados correctamente';
    msg.className = 'text-success small';
    
    loadDashboard();
    
    setTimeout(() => {
      const modal = bootstrap.Modal.getInstance(el('#editClienteModal'));
      if (modal) modal.hide();
    }, 1500);
  } catch (err) {
    msg.textContent = err.body && err.body.error ? err.body.error : 'Error al guardar los cambios';
    msg.className = 'text-danger small';
  }
}

async function authRegister(e){
  e.preventDefault();
  const nombre = el('#reg-nombre').value.trim();
  const username = el('#reg-username').value.trim();
  const email = el('#reg-email').value.trim();
  const password = el('#reg-password').value;
  const msg = el('#register-msg'); msg.textContent='';
  try{
    const res = await api('/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nombre, username, email, password }) });
    saveAuth(res.token, res.cliente);
    const m = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
    if (m) m.hide();
    location.reload();
  }catch(err){ msg.textContent = err.body && err.body.error ? err.body.error : 'Error'; }
}

async function authLogin(e){
  e.preventDefault();
  const identifier = el('#login-identifier').value.trim();
  const password = el('#login-password').value;
  const msg = el('#login-msg'); msg.textContent='';
  try{
    const res = await api('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ identifier, password }) });
    saveAuth(res.token, res.cliente);
    const m = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (m) m.hide();
    location.reload();
  }catch(err){ msg.textContent = err.body && err.body.error ? err.body.error : 'Error'; }
}

function el(q){return document.querySelector(q)}
function elAll(q){return document.querySelectorAll(q)}

function escapeHtml(str){
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let dashboardData = { clientes: [], productos: [], pedidos: [] };
let searchQueries = { clientes: '', productos: '', pedidos: '' };

function updateSearchDisplay(){
  // Search inputs are embedded in each visible section, so no extra global display logic is needed.
}

function attachSearchHandlers(){
  const clientesInput = el('#search-clientes');
  const productosInput = el('#search-productos');
  const pedidosInput = el('#search-pedidos');

  if (clientesInput) {
    clientesInput.value = searchQueries.clientes;
    clientesInput.oninput = (event) => {
      searchQueries.clientes = event.target.value.trim().toLowerCase();
      renderFilteredTables();
    };
  }

  if (productosInput) {
    productosInput.value = searchQueries.productos;
    productosInput.oninput = (event) => {
      searchQueries.productos = event.target.value.trim().toLowerCase();
      renderFilteredTables();
    };
  }

  if (pedidosInput) {
    pedidosInput.value = searchQueries.pedidos;
    pedidosInput.oninput = (event) => {
      searchQueries.pedidos = event.target.value.trim().toLowerCase();
      renderFilteredTables();
    };
  }
}

function normalizeText(value){
  return (value || '').toString().toLowerCase();
}

const CATEGORY_MAP = {
  computadora: 'Computadoras',
  computadoras: 'Computadoras',
  computador: 'Computadoras',
  computadores: 'Computadoras',
  pc: 'Computadoras',
  laptop: 'Computadoras',
  laptops: 'Computadoras',
  notebook: 'Computadoras',
  notebooks: 'Computadoras',
  celular: 'Celulares',
  celulares: 'Celulares',
  smartphone: 'Celulares',
  smartphones: 'Celulares',
  movil: 'Celulares',
  móvil: 'Celulares',
  audifonos: 'Audifonos',
  audífonos: 'Audifonos',
  auriculares: 'Audifonos',
  headset: 'Audifonos',
  headphone: 'Audifonos',
  headphones: 'Audifonos',
  mouse: 'Mouse',
  raton: 'Mouse',
  ratón: 'Mouse',
  teclado: 'Teclados',
  teclados: 'Teclados',
  memoria: 'Memorias',
  memorias: 'Memorias',
  ssd: 'Memorias',
  usb: 'Memorias',
  pendrive: 'Memorias',
  impresora: 'Impresoras',
  impresoras: 'Impresoras',
  camara: 'Camaras',
  camaras: 'Camaras',
  cámara: 'Camaras',
  cámaras: 'Camaras',
  microfono: 'Microfonos',
  microfonos: 'Microfonos',
  micrófono: 'Microfonos',
  micrófonos: 'Microfonos',
  mic: 'Microfonos',
  parlante: 'Parlantes',
  parlantes: 'Parlantes',
  altavoz: 'Parlantes',
  altavoces: 'Parlantes',
  bocina: 'Parlantes',
  bocinas: 'Parlantes',
  drone: 'Drones',
  drones: 'Drones',
  cuadricoptero: 'Drones',
  cuadricóptero: 'Drones',
  cable: 'Cables',
  cables: 'Cables'
};

function normalizeCategory(value){
  if (!value) return '';
  const key = normalizeText(value);
  return CATEGORY_MAP[key] || capitalizeFirstLetter(value);
}

const CATEGORY_ORDER = ['Computadoras','Celulares','Audifonos','Mouse','Teclados','Memorias','Impresoras','Camaras','Drones','Microfonos','Parlantes','Cables'];

function sortProductsByCategory(list){
  if (!Array.isArray(list)) return list;
  return list.slice().sort((a,b)=>{
    const ca = normalizeCategory(a.categoria || '');
    const cb = normalizeCategory(b.categoria || '');
    const ia = CATEGORY_ORDER.indexOf(ca);
    const ib = CATEGORY_ORDER.indexOf(cb);
    const rankA = ia === -1 ? CATEGORY_ORDER.length : ia;
    const rankB = ib === -1 ? CATEGORY_ORDER.length : ib;
    if (rankA !== rankB) return rankA - rankB;
    return normalizeText(a.nombre).localeCompare(normalizeText(b.nombre));
  });
}

const categoryEmojis = {
  'Computadoras': '💻',
  'Celulares': '📱',
  'Audifonos': '🎧',
  'Mouse': '🖱️',
  'Teclados': '⌨️',
  'Memorias': '💾',
  'Impresoras': '🖨️',
  'Camaras': '📷',
  'Drones': '🚁',
  'Microfonos': '🎙️',
  'Parlantes': '🔊',
  'Cables': '🔌'
};

function getCategoryEmoji(categoria, nombre = ''){
  if (!categoria && !nombre) return '📦';
  const lowerCat = normalizeText(categoria || '');
  const lowerName = normalizeText(nombre || '');
  const lower = `${lowerCat} ${lowerName}`.trim();

  for (const [cat, emoji] of Object.entries(categoryEmojis)) {
    const normalizedCat = normalizeText(cat);
    if (lowerCat === normalizedCat || lower.includes(normalizedCat)) return emoji;
  }

  if (lower.includes('laptop') || lower.includes('notebook') || lower.includes('computadora') || lower.includes('computador') || lower.includes('computadores')) return '💻';
  if (lower.includes('mouse') || lower.includes('ratón') || lower.includes('raton')) return '🖱️';
  if (lower.includes('teclado')) return '⌨️';
  if (lower.includes('monitor') || lower.includes('pantalla')) return '🖥️';
  if (lower.includes('auricular') || lower.includes('headset') || lower.includes('audio')) return '🎧';
  if (lower.includes('smartphone') || lower.includes('celular') || lower.includes('móvil') || lower.includes('movil')) return '📱';
  if (lower.includes('cámara') || lower.includes('camara') || lower.includes('foto')) return '📷';
  if (lower.includes('drone') || lower.includes('dron') || lower.includes('cuadricoptero') || lower.includes('cuadricóptero')) return '🚁';
  if (lower.includes('silla') || lower.includes('gamer')) return '🪑';
  if (lower.includes('cd') || lower.includes('disco')) return '💿';
  if (lower.includes('consola') || lower.includes('videojuego') || lower.includes('playstation') || lower.includes('nintendo') || lower.includes('xbox')) return '🎮';
  return '📦';
}

function filterClients(list){
  const query = searchQueries.clientes;
  if (!query) return list;
  return list.filter(c => {
    return normalizeText(c.nombre).includes(query)
      || normalizeText(c.email).includes(query)
      || normalizeText(c.username).includes(query)
      || normalizeText(c.direccion).includes(query)
      || normalizeText(c.telefono).includes(query);
  });
}

function filterProducts(list){
  const query = searchQueries.productos;
  if (!query) return list;
  return list.filter(p => {
    return normalizeText(p.nombre).includes(query)
      || normalizeText(p.categoria).includes(query)
      || normalizeText(p.precio).includes(query)
      || normalizeText(p.stock).includes(query);
  });
}

function filterPedidos(list){
  const query = searchQueries.pedidos;
  if (!query) return list;
  return list.filter(o => {
    const clienteName = normalizeText([
      o.cliente && o.cliente.nombre,
      o.cliente && o.cliente.username,
      o.cliente && o.cliente.email,
      o.nombreCliente
    ].filter(Boolean).join(' '));
    const direccion = normalizeText(o.direccionEnvio);
    const estado = normalizeText(o.estado);
    const items = normalizeText((o.items || []).map(i => [i.nombre, i.producto && i.producto.nombre].filter(Boolean).join(' ')).join(' '));
    const total = normalizeText(o.total);
    return clienteName.includes(query)
      || direccion.includes(query)
      || estado.includes(query)
      || items.includes(query)
      || total.includes(query);
  });
}

function renderFilteredTables(){
  renderClientsTable(filterClients(dashboardData.clientes));
  renderProductsTable(sortProductsByCategory(filterProducts(dashboardData.productos)));
  renderPedidosTable(filterPedidos(dashboardData.pedidos));
}

// Show a small badge in the Pedidos nav with the number of pedidos for the current user
function renderPedidosCount(){
  const navLink = el('#nav-pedidos a'); if (!navLink) return;
  const count = (dashboardData && Array.isArray(dashboardData.pedidos)) ? dashboardData.pedidos.length : 0;
  let badge = navLink.querySelector('.nav-pedidos-count');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-pedidos-count badge bg-primary ms-2';
      badge.setAttribute('aria-hidden','true');
      navLink.appendChild(badge);
    }
    badge.textContent = count;
  } else {
    if (badge) badge.remove();
  }
}

async function loadClients(){
  try{
    const list = await api('/clientes');
    renderClients(list);
  }catch(e){console.error(e); el('#clients').innerHTML = '<div class="empty">No se pudo cargar la lista</div>'}
}

function renderClients(list){
  const root = el('#clients');
  if(!list || list.length===0){ root.innerHTML = '<div class="empty">No hay clientes aún</div>'; return }
  root.innerHTML = '';
  const ul = document.createElement('ul'); ul.className='clients-list';
  list.forEach(c=>{
    const li = document.createElement('li'); li.className='client-item';
    const meta = document.createElement('div'); meta.className='client-meta';
    const name = document.createElement('div'); name.className='client-name'; name.textContent = c.nombre;
    const email = document.createElement('div'); email.className='client-email'; email.textContent = c.email;
    meta.appendChild(name); meta.appendChild(email);
    const actions = document.createElement('div'); actions.className='actions';
    const edit = document.createElement('button'); edit.className='small secondary'; edit.textContent='Editar';
    edit.onclick = ()=> showModal('editClienteModal', c);
    const del = document.createElement('button'); del.className='small btn-danger'; del.textContent='Eliminar';
    del.onclick = ()=> deleteClient(c._id);
    actions.appendChild(edit); actions.appendChild(del);
    li.appendChild(meta); li.appendChild(actions);
    ul.appendChild(li);
  });
  root.appendChild(ul);
}

async function submitForm(e){
  e.preventDefault();
  const nombre = el('#nombre').value.trim();
  const email = el('#email').value.trim();
  const direccion = el('#direccion').value.trim();
  const telefono = el('#telefono').value.trim();
  const msg = el('#msg');
  msg.textContent='';
  try{
    const created = await api('/clientes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nombre,email,direccion,telefono}) });
    msg.textContent='Cliente creado.';
    el('#formClientes').reset();
    loadClients();
  }catch(err){
    msg.textContent = err.body && err.body.error ? err.body.error : 'Error';
  }
}

function editClient(client){
  const nombre = prompt('Nombre', client.nombre);
  if (nombre === null) return;
  const email = prompt('Email', client.email);
  if (email === null) return;
  const updates = {}; if (nombre!==client.nombre) updates.nombre=nombre; if (email!==client.email) updates.email=email;
  if (Object.keys(updates).length===0) return alert('No changes');
  api('/clientes/'+client._id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    .then(()=>{ alert('Cliente actualizado'); loadClients(); })
    .catch(e=>{ alert(e.body && e.body.error ? e.body.error : 'Error al actualizar') });
}

function deleteClient(id){
  if(!confirm('Eliminar cliente?')) return;
  api('/clientes/'+id, { method:'DELETE' }).then(()=>{ loadClients(); }).catch(e=>alert('Error al eliminar'));
}

async function loadProducts(){
  try {
    const list = await api('/productos');
    renderProducts(list);
  } catch (err) {
    console.error(err);
    el('#product-list').innerHTML = '<div class="empty">No se pudieron cargar los productos</div>';
  }
}

function renderProducts(list){
  const root = el('#product-list');
  if (!list || list.length === 0) {
    root.innerHTML = '<div class="empty">Aún no hay productos registrados</div>';
    return;
  }
  root.innerHTML = '';
  const fragment = document.createDocumentFragment();
  list.forEach(p => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `<strong>${p.nombre}</strong><span>${p.categoria} • $${p.precio.toFixed(2)} • Stock: ${p.stock}</span>`;
    fragment.appendChild(item);
  });
  root.appendChild(fragment);
}

let orderCart = [];

async function loadOrderPage(){
  // Ensure auth is loaded first
  loadAuthFromStorage();
  console.log('loadOrderPage: currentUser after loadAuthFromStorage:', currentUser);
  
  // Always initialize orderCart from the drawer/localStorage so items persist even if API calls fail
  try {
    const stored = getCart();
    orderCart = (stored || []).map(i=>({ _id: i._id, nombre: i.nombre, precio: Number(i.precio||0), cantidad: Number(i.cantidad||1), subtotal: Number(i.precio||0) * Number(i.cantidad||1) }));
  } catch(e){ orderCart = []; }

  let clients = [];

  try {
    if (currentUser && currentUser.isAdmin) {
      clients = await api('/clientes');
    }
  } catch (err) {
    console.error('Error cargando clientes para pedido', err);
    clients = [];
  }

  await renderOrderClients(clients);
  renderOrderCart();
}

async function renderOrderClients(list){
  const select = el('#pedido-cliente');
  const selectRow = el('#cliente-select-row');
  const infoRow = el('#cliente-info-row');
  
  if (!select) return;
  
  // Load auth first to ensure currentUser is populated
  loadAuthFromStorage();
  console.log('renderOrderClients - currentUser:', currentUser);
  
  // If user is logged in, show client info instead of select
  if (currentUser && (currentUser.email || currentUser.nombre)) {
    const idVal = currentUser._id || currentUser.id || currentUser.email || '';
    const name = currentUser.nombre || currentUser.username || currentUser.email || 'Mi cuenta';
    const email = currentUser.email || '';
    const telefono = currentUser.telefono || '';

    console.log('Showing client info:', { name, email, telefono, idVal });

    // Update the client info display - set text content
    const nombreEl = el('#cliente-nombre');
    const emailEl = el('#cliente-email');
    const telefonoEl = el('#cliente-telefono');
    
    if (nombreEl) nombreEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (telefonoEl) telefonoEl.textContent = telefono ? 'Tel: ' + telefono : '';
    
    // Hide select, show info
    if (selectRow) selectRow.style.display = 'none';
    if (infoRow) {
      infoRow.style.display = '';
      console.log('Info row is now visible');
    }
    
    // Create hidden input for cliente ID
    let hiddenInput = el('#pedido-cliente-id');
    if (!hiddenInput) {
      hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.id = 'pedido-cliente-id';
      hiddenInput.value = idVal;
      select.parentNode.appendChild(hiddenInput);
    } else {
      hiddenInput.value = idVal;
    }
    
    return;
  }

  // No logged user: populate select options normally
  console.log('No logged user, showing select with clients');
  if (selectRow) selectRow.style.display = '';
  if (infoRow) infoRow.style.display = 'none';
  
  select.innerHTML = '<option value="">Selecciona un cliente</option>';
  if (!list || list.length === 0) return;
  list.forEach(c => {
    const option = document.createElement('option');
    option.value = c._id;
    option.textContent = `${c.nombre} — ${c.email}`;
    select.appendChild(option);
  });
}

function renderOrderProducts(list){
  const root = el('#product-options');
  if (!root) return;
  if (!list || list.length === 0) {
    root.innerHTML = '<div class="empty">No hay productos disponibles</div>';
    return;
  }
  root.innerHTML = '';
  const fragment = document.createDocumentFragment();
  list.forEach(p => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `
      <strong>${p.nombre}</strong>
      <span>${p.categoria} • $${p.precio.toFixed(2)} • Stock: ${p.stock}</span>
      <button type="button" class="small" data-id="${p._id}" data-name="${p.nombre}" data-price="${p.precio}">Agregar</button>
    `;
    const button = item.querySelector('button');
    button.addEventListener('click', () => addToCart(p));
    fragment.appendChild(item);
  });
  root.appendChild(fragment);
}

function addToCart(product){
  const existing = orderCart.find(item => item._id === product._id);
  if (existing) {
    existing.cantidad += 1;
    existing.subtotal = existing.cantidad * existing.precio;
  } else {
    orderCart.push({
      _id: product._id,
      nombre: product.nombre,
      precio: product.precio,
      cantidad: 1,
      subtotal: product.precio
    });
  }
  renderOrderCart();
}

function renderOrderCart(){
  const root = el('#pedido-cart');
  if (!root) return;
  const totalNode = el('#pedido-total');
  if (orderCart.length === 0) {
    root.innerHTML = '<div class="empty">El carrito está vacío</div>';
    if (totalNode) totalNode.textContent = '';
    return;
  }
  root.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'order-cart-list';

  orderCart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'order-item';
    row.innerHTML = `
      <div class="order-item-info">
        <strong>${item.nombre}</strong>
        <span>$${item.precio.toFixed(2)} x ${item.cantidad} = $${item.subtotal.toFixed(2)}</span>
      </div>
      <div class="order-actions">
        <button type="button" class="small secondary">-</button>
        <button type="button" class="small secondary">+</button>
        <button type="button" class="small btn-danger">Eliminar</button>
      </div>
    `;
    const [minusBtn, plusBtn, removeBtn] = row.querySelectorAll('button');
    minusBtn.addEventListener('click', () => {
      if (item.cantidad > 1) {
        item.cantidad -= 1;
        item.subtotal = item.cantidad * item.precio;
      } else {
        orderCart = orderCart.filter(i => i._id !== item._id);
      }
      renderOrderCart();
    });
    plusBtn.addEventListener('click', () => {
      item.cantidad += 1;
      item.subtotal = item.cantidad * item.precio;
      renderOrderCart();
    });
    removeBtn.addEventListener('click', () => {
      orderCart = orderCart.filter(i => i._id !== item._id);
      renderOrderCart();
    });
    list.appendChild(row);
  });

  root.appendChild(list);
  const total = orderCart.reduce((sum, item) => sum + item.subtotal, 0);
  if (totalNode) totalNode.textContent = `Total: $${total.toFixed(2)}`;
}

function clearOrderCart(){
  orderCart = [];
  renderOrderCart();
  try{ saveCart([]); }catch(e){}
}

async function submitOrderForm(e){
  e.preventDefault();
  let cliente = el('#pedido-cliente').value;
  
  // Si el select está oculto (usuario logueado), usar el hidden input
  if (!cliente) {
    const hiddenId = el('#pedido-cliente-id');
    cliente = hiddenId ? hiddenId.value : '';
  }
  
  const direccionEnvio = el('#pedido-direccion').value.trim();
  const msg = el('#pedido-msg');
  msg.textContent = '';

  if (!cliente) {
    msg.textContent = 'Selecciona un cliente antes de enviar el pedido.';
    return;
  }
  if (orderCart.length === 0) {
    msg.textContent = 'Agrega al menos un producto al carrito.';
    return;
  }

  const items = orderCart.map(item => ({
    producto: item._id,
    cantidad: item.cantidad
  }));

  try {
    await api('/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, direccionEnvio, items })
    });
    msg.textContent = 'Pedido creado correctamente.';
    clearOrderCart();
    // clear drawer/localStorage cart as well
    try{ saveCart([]); }catch(e){}
    if (el('#pedido-direccion')) el('#pedido-direccion').value = '';
    if (el('#pedido-cliente')) el('#pedido-cliente').selectedIndex = 0;
  } catch (err) {
    msg.textContent = err.body && err.body.error ? err.body.error : 'Error al crear el pedido';
  }
}

function capitalizeFirstLetter(value){
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function capitalizeFirstChar(value){
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getQueryParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

async function submitProductForm(e){
  e.preventDefault();
  const nombre = el('#producto-nombre').value.trim();
  let categoria = el('#producto-categoria').value.trim();
  categoria = capitalizeFirstLetter(categoria);
  const precio = Number(el('#producto-precio').value);
  const stock = Number(el('#producto-stock').value);
  const msg = el('#product-msg');

  if (!nombre || !categoria || !Number.isFinite(precio) || !Number.isFinite(stock)) {
    msg.textContent = 'Completa todos los campos obligatorios.';
    return;
  }

  const nombreFormatted = capitalizeFirstChar(nombre);

  try {
    await api('/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreFormatted, categoria, precio, stock })
    });
    msg.textContent = `Producto "${nombre}" guardado.`;
    el('#product-form').reset();
    loadProducts();
  } catch (err) {
    msg.textContent = err.body && err.body.error ? err.body.error : 'Error al guardar el producto';
  }
}

async function loadProductFormForEdit(id){
  const msg = el('#product-msg');
  const title = el('#product-form-title');
  const submitBtn = el('#formProducto button[type="submit"]');
  if (!id || !msg) return;
  if (title) title.textContent = 'Editar producto';
  if (submitBtn) submitBtn.textContent = 'Guardar cambios';
  msg.textContent = 'Cargando producto para edición...';
  try {
    const product = await api('/productos/' + encodeURIComponent(id));
    el('#producto-nombre').value = product.nombre || '';
    el('#producto-categoria').value = product.categoria || '';
    el('#producto-precio').value = product.precio || 0;
    el('#producto-stock').value = product.stock || 0;
    msg.textContent = 'Edita los campos y guarda los cambios.';
  } catch (err) {
    msg.textContent = err.body && err.body.error ? err.body.error : 'No se pudo cargar el producto para edición.';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadAuthFromStorage();
  renderAuthUI();
  updateCartBadge();
  initCartButtons();
  if (el('#login-form')) el('#login-form').addEventListener('submit', authLogin);
  if (el('#register-form')) el('#register-form').addEventListener('submit', authRegister);
  if (el('#edit-cliente-form')) el('#edit-cliente-form').addEventListener('submit', submitClienteEdit);
  if (el('#formClientes')) {
    el('#formClientes').addEventListener('submit', submitForm);
    createBackHomeButton();
  }
  if (el('#formProducto')) {
    if (!currentUser || !currentUser.isAdmin) {
      document.body.innerHTML = '<div class="container p-4"><h2>Acceso denegado</h2><p>Solo los administradores pueden crear productos.</p><a href="/">Volver al inicio</a></div>';
      return;
    }
    el('#formProducto').addEventListener('submit', submitProductForm);
    loadProducts();
    createBackHomeButton();
  }
  if (el('#formPedidos')) {
    el('#formPedidos').addEventListener('submit', submitOrderForm);
    if (el('#clear-cart')) el('#clear-cart').addEventListener('click', clearOrderCart);
    loadOrderPage();
    createBackHomeButton();
  }
  if (el('#confirm-delete-product-btn')) {
    el('#confirm-delete-product-btn').addEventListener('click', () => deleteProduct());
  }
  if (el('#confirm-delete-order-btn')) {
    el('#confirm-delete-order-btn').addEventListener('click', () => deleteOrder());
  }
  if (el('#confirm-stock-save-btn')) {
    el('#confirm-stock-save-btn').addEventListener('click', () => submitEditStock());
  }
  if (el('#confirm-edit-order-status-btn')) {
    el('#confirm-edit-order-status-btn').addEventListener('click', () => submitEditOrder());
  }
  if (el('#clients')) loadClients();
  // Dashboard tables on index — only load admin dashboard when authenticated
  if (el('#clients-table')) {
    if (currentUser && currentUser.isAdmin) {
      loadDashboard();
      // Ensure admin sections visible
      const clientsSection = el('#clientes'); if (clientsSection) clientsSection.style.display = '';
      const pedidosSection = el('#pedidos'); if (pedidosSection) pedidosSection.style.display = '';
      updateSearchDisplay();
      attachSearchHandlers();
    } else {
      // show products for guests and regular users
      api('/productos').then(list => {
        dashboardData.productos = list;
        renderFilteredTables();
      }).catch(()=>{});
      // hide admin-only sections
      const clientsSection = el('#clientes'); if (clientsSection) clientsSection.style.display = 'none';
      const pedidosSection = el('#pedidos'); if (pedidosSection) pedidosSection.style.display = (currentUser ? '' : 'none');
      // For non-admin users, load only their pedidos (server returns only their pedidos)
      if (currentUser) {
        api('/pedidos').then(list => {
          dashboardData.pedidos = list;
          renderFilteredTables();
        }).catch(()=>{});
      }
      attachSearchHandlers();
    }
  }
  // init nav handlers
  initPedidosNavHandler();
  initPedidosBackButton();
});

// When user clicks the 'Pedidos' nav link, show pedidos section and load user's orders
function initPedidosNavHandler(){
  const navPedidos = el('#nav-pedidos');
  if (!navPedidos) return;
  navPedidos.addEventListener('click', async (e)=>{
    e.preventDefault();
    // ensure auth state
    loadAuthFromStorage();
    if (!currentUser) {
      showModal('loginModal');
      return;
    }
    // show pedidos section and hide other main sections for focus
    const pedidosSection = el('#pedidos'); if (pedidosSection) pedidosSection.style.display = '';
    const clientsSection = el('#clientes'); if (clientsSection) clientsSection.style.display = 'none';
    const productosSection = el('#productos'); if (productosSection) productosSection.style.display = 'none';
    const hero = document.querySelector('.hero'); if (hero) hero.style.display = 'none';
    // mark nav active
    document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
    const link = navPedidos.querySelector('a'); if (link) link.classList.add('active');
    try {
      const list = await api('/pedidos');
      dashboardData.pedidos = list;
      renderFilteredTables();
      attachSearchHandlers();
      renderPedidosCount();
      // focus the pedidos search input for quick filtering
      const searchInput = el('#search-pedidos');
      if (searchInput) { try{ searchInput.focus(); searchInput.select(); }catch(e){} }
      if (pedidosSection) pedidosSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Error cargando pedidos desde nav', err);
      alert('No se pudieron cargar los pedidos.');
    }
  });
}

// Volver al inicio desde Pedidos
function initPedidosBackButton(){
  const btn = el('#pedidos-back-home');
  if (!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    // show hero and products
    const hero = document.querySelector('.hero'); if (hero) hero.style.display = '';
    const productosSection = el('#productos'); if (productosSection) productosSection.style.display = '';
    const pedidosSection = el('#pedidos'); if (pedidosSection) pedidosSection.style.display = 'none';
    // restore clients visibility based on admin
    const clientsSection = el('#clientes'); if (clientsSection) clientsSection.style.display = (currentUser && currentUser.isAdmin) ? '' : 'none';
    // set nav active
    document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
    const prodLink = el('#nav-productos a'); if (prodLink) prodLink.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Dashboard: load all and render tables
async function loadDashboard(){
  try{
    const [clients, products, pedidos] = await Promise.all([api('/clientes'), api('/productos'), api('/pedidos')]);
    dashboardData = { clientes: clients, productos: products, pedidos };
    renderFilteredTables();
    updateSearchDisplay();
    attachSearchHandlers();
    renderPedidosCount();
  }catch(err){ console.error('Error cargando dashboard', err) }
}

function renderClientsTable(list){
  const adminTbody = el('#admin-clients-table tbody');
  const clientsTbody = el('#clients-table tbody');
  if(!adminTbody || !clientsTbody) return;
  adminTbody.innerHTML='';
  clientsTbody.innerHTML='';
  if(!list || list.length===0){
    clientsTbody.innerHTML = '<tr><td colspan="5">No hay clientes</td></tr>';
    adminTbody.innerHTML = '<tr><td colspan="5">No hay administradores</td></tr>';
    return;
  }
  const admins = list.filter(c => c.isAdmin);
  const normalClients = list.filter(c => !c.isAdmin);

  if(admins.length === 0){
    adminTbody.innerHTML = '<tr><td colspan="5">No hay administradores</td></tr>';
  } else {
    admins.forEach(c=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.email}</td>
        <td>${c.direccion || ''}</td>
        <td>${c.telefono || ''}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-primary">Editar</button>
          <button class="btn btn-sm btn-outline-danger">Eliminar</button>
        </td>
      `;
      tr.querySelector('.btn-outline-primary').addEventListener('click', ()=> showModal('editClienteModal', c));
      tr.querySelector('.btn-outline-danger').addEventListener('click', ()=> deleteClient(c._id).then(()=>loadDashboard()));
      adminTbody.appendChild(tr);
    });
  }

  if(normalClients.length === 0){
    clientsTbody.innerHTML = '<tr><td colspan="5">No hay clientes</td></tr>';
  } else {
    normalClients.forEach(c=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.email}</td>
        <td>${c.direccion || ''}</td>
        <td>${c.telefono || ''}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-primary">Editar</button>
          <button class="btn btn-sm btn-outline-danger">Eliminar</button>
        </td>
      `;
      tr.querySelector('.btn-outline-primary').addEventListener('click', ()=> showModal('editClienteModal', c));
      tr.querySelector('.btn-outline-danger').addEventListener('click', ()=> deleteClient(c._id).then(()=>loadDashboard()));
      clientsTbody.appendChild(tr);
    });
  }
}

function renderProductsTable(list){
  const tbody = el('#products-table tbody');
  const cardsRoot = el('#products-cards');
  if (!tbody || !cardsRoot) return;

  if (currentUser && currentUser.isAdmin) {
    cardsRoot.style.display = 'none';
    el('#products-table').style.display = '';
    tbody.innerHTML = '';
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No hay productos</td></tr>';
      return;
    }
    list.forEach(p => {
      const productId = p._id || p.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(capitalizeFirstLetter(p.categoria))}</td>
        <td>$${Number(p.precio).toFixed(2)}</td>
        <td><span class="badge stock-badge">${escapeHtml(p.stock)}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-primary">Editar</button>
          <button class="btn btn-sm btn-outline-danger">Eliminar</button>
        </td>
      `;
      const editStockBtn = tr.querySelector('.btn-outline-primary');
      const deleteBtn = tr.querySelector('.btn-outline-danger');
      if (editStockBtn) editStockBtn.addEventListener('click', () => openEditStockModal({ ...p, _id: productId }));
      if (deleteBtn) deleteBtn.addEventListener('click', () => openDeleteProductModal({ ...p, _id: productId }));
      tbody.appendChild(tr);
    });
    return;
  }

  // Regular users and guests see product cards for shopping
  el('#products-table').style.display = 'none';
  cardsRoot.style.display = '';
  cardsRoot.innerHTML = '';
  if (!list || list.length === 0) {
    cardsRoot.innerHTML = '<div class="empty">No hay productos</div>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card-item';
    const emoji = getCategoryEmoji(p.categoria, p.nombre);
    card.innerHTML = `
      <div class="product-card-body">
        <div class="product-card-top">
          <span class="product-card-emoji">${emoji}</span>
          <div>
            <div class="product-card-title">${escapeHtml(p.nombre)}</div>
            <div class="product-card-tag">${escapeHtml(capitalizeFirstLetter(p.categoria))}</div>
          </div>
        </div>
        <div class="product-card-meta">Precio: <strong>$${Number(p.precio).toFixed(2)}</strong></div>
        <div class="product-card-meta">Stock: <span class="badge stock-badge">${escapeHtml(p.stock)}</span></div>
      </div>
      <button class="btn btn-sm btn-primary add-cart" data-id="${escapeHtml(p._id)}">🛒 Añadir al carrito</button>
    `;
    cardsRoot.appendChild(card);
  });

  cardsRoot.querySelectorAll('.add-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      addToCartLocal(id);
    });
  });
}
function addToCartLocal(productId){
  const prod = dashboardData.productos.find(p=>p._id===productId);
  if (!prod) return;
  const cart = getCart();
  const existing = cart.find(i=>i._id===prod._id);
  if (existing) existing.cantidad = Number(existing.cantidad||1) + 1;
  else cart.push({ _id: prod._id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
  saveCart(cart);
  // brief visual feedback: toast + pulse on cart button
  showToast(`${prod.nombre} añadido al carrito`);
  const cartBtn = el('#cart-btn'); if (cartBtn){ cartBtn.classList.add('pulse'); setTimeout(()=> cartBtn.classList.remove('pulse'), 700); }
}

function renderPedidosTable(list){
  const thead = el('#pedidos-thead');
  const tbody = el('#pedidos-table tbody'); if(!tbody || !thead) return;
  // render header depending on admin status
  if (currentUser && currentUser.isAdmin) {
    thead.innerHTML = '<tr><th>Cliente</th><th>Items</th><th>Total</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr>';
  } else {
    thead.innerHTML = '<tr><th>Cliente</th><th>Items</th><th>Total</th><th>Dirección</th><th>Estado</th></tr>';
  }
  tbody.innerHTML='';
  if(!list || list.length===0){
    const colspan = (currentUser && currentUser.isAdmin) ? 6 : 5;
    tbody.innerHTML = `<tr><td colspan="${colspan}">No hay pedidos</td></tr>`;
    return;
  }
  list.forEach(o=>{
    const itemsText = (o.items||[]).map(i=>`${i.nombre} x${i.cantidad}`).join(', ');
    const tr = document.createElement('tr');
    let pedidoActions = '';
    if (currentUser && currentUser.isAdmin) {
      pedidoActions = `
        <button class="btn btn-sm btn-outline-primary me-1">Editar estado</button>
        <button class="btn btn-sm btn-outline-danger">Eliminar</button>
      `;
    }
    const estadoClass = String(o.estado || '').toLowerCase().replace(/\s+/g,'-');
    // Build row HTML conditionally including actions column only for admins
    if (currentUser && currentUser.isAdmin) {
      tr.innerHTML = `
        <td>${o.cliente ? o.cliente.nombre : '—'}</td>
        <td>${itemsText}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td>${o.direccionEnvio||''}</td>
        <td class="status-cell"><span class="status-pill ${estadoClass}">${escapeHtml(o.estado || '—')}</span></td>
        <td class="actions-cell">${pedidoActions}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${o.cliente ? o.cliente.nombre : '—'}</td>
        <td>${itemsText}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td>${o.direccionEnvio||''}</td>
        <td class="status-cell"><span class="status-pill ${estadoClass}">${escapeHtml(o.estado || '—')}</span></td>
      `;
    }
    // add data-label attributes for responsive stacked view
    try{
      const tds = tr.querySelectorAll('td');
      if (tds && tds.length) {
        tds[0].setAttribute('data-label', 'Cliente');
        if(tds[1]) tds[1].setAttribute('data-label', 'Items');
        if(tds[2]) tds[2].setAttribute('data-label', 'Total');
        if(tds[3]) tds[3].setAttribute('data-label', 'Dirección');
        if(tds[4]) tds[4].setAttribute('data-label', 'Estado');
        if(tds[5]) tds[5].setAttribute('data-label', 'Acciones');
      }
    }catch(e){}
    if (currentUser && currentUser.isAdmin) {
      const editBtn = tr.querySelector('.btn-outline-primary');
      const deleteBtn = tr.querySelector('.btn-outline-danger');
      if (editBtn) editBtn.addEventListener('click', ()=> openEditOrderModal(o));
      if (deleteBtn) deleteBtn.addEventListener('click', ()=> openDeleteOrderModal(o));
    }
    tbody.appendChild(tr);
  });
}

function openDeleteProductModal(product){
  if (!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden eliminar productos');
  pendingDeleteProductId = product._id || product.id || '';
  const nameNode = el('#delete-product-name');
  if (nameNode) nameNode.textContent = product.nombre || 'Este producto';
  const modalEl = document.getElementById('deleteProductModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  modal.show();
}

async function deleteProduct(id){
  if(!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden eliminar productos');
  const productId = id || pendingDeleteProductId || '';
  if (!productId) return alert('Producto inválido');
  try{
    await api('/productos/'+encodeURIComponent(productId), { method:'DELETE' });
    pendingDeleteProductId = null;
    const modal = bootstrap.Modal.getInstance(el('#deleteProductModal'));
    if (modal) modal.hide();
    loadDashboard();
  }catch(e){
    alert(e.body && e.body.error ? e.body.error : 'Error al eliminar producto');
  }
}

function openEditStockModal(product){
  if (!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden editar productos');
  pendingStockProductId = product._id || product.id || '';
  const nameNode = el('#edit-stock-product-name');
  const nombreInput = el('#edit-product-name');
  const categoriaInput = el('#edit-product-category');
  const precioInput = el('#edit-product-price');
  const stockInput = el('#edit-product-stock');
  const msg = el('#edit-stock-msg');
  if (nameNode) nameNode.textContent = product.nombre || 'Producto';
  if (nombreInput) nombreInput.value = product.nombre || '';
  if (categoriaInput) categoriaInput.value = product.categoria || '';
  if (precioInput) precioInput.value = Number(product.precio || 0);
  if (stockInput) stockInput.value = Number(product.stock || 0);
  if (msg) msg.textContent = '';
  const modalEl = document.getElementById('editStockModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  modal.show();
}

async function submitEditStock(){
  if (!pendingStockProductId) return;
  const nombreInput = el('#edit-product-name');
  const categoriaInput = el('#edit-product-category');
  const precioInput = el('#edit-product-price');
  const stockInput = el('#edit-product-stock');
  const descripcionInput = el('#edit-product-description');
  const msg = el('#edit-stock-msg');
  if (!nombreInput || !categoriaInput || !precioInput || !stockInput || !msg) return;

  const nombre = capitalizeFirstChar(nombreInput.value.trim());
  let categoria = categoriaInput.value.trim();
  categoria = capitalizeFirstLetter(categoria);
  const precio = Number(precioInput.value);
  const stockValue = Number(stockInput.value);

  if (!nombre || !categoria || !Number.isFinite(precio) || !Number.isFinite(stockValue) || stockValue < 0) {
    msg.textContent = 'Completa todos los campos con valores válidos.';
    return;
  }

  try {
    await api('/productos/' + encodeURIComponent(pendingStockProductId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoria, precio, stock: stockValue })
    });
    msg.textContent = '';
    const modal = bootstrap.Modal.getInstance(el('#editStockModal'));
    if (modal) modal.hide();
    pendingStockProductId = null;
    loadDashboard();
  } catch (e) {
    msg.textContent = e.body && e.body.error ? e.body.error : 'Error al actualizar el producto.';
  }
}

function openEditOrderModal(order){
  if(!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden editar pedidos');
  pendingEditOrderId = order._id || order.id || '';
  const orderIdNode = el('#edit-order-id');
  const estadoInput = el('#edit-order-status');
  const clienteNode = el('#edit-order-client');
  const direccionInput = el('#edit-order-address');
  const msg = el('#edit-order-msg');
  if (orderIdNode) orderIdNode.value = pendingEditOrderId;
  if (clienteNode) clienteNode.textContent = order.cliente ? order.cliente.nombre : 'Pedido';
  if (estadoInput) estadoInput.value = order.estado || 'pendiente';
  if (direccionInput) direccionInput.value = order.direccionEnvio || '';
  if (msg) msg.textContent = '';
  const modalEl = document.getElementById('editOrderModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  modal.show();
}

async function submitEditOrder(){
  if (!pendingEditOrderId) return;
  const estadoInput = el('#edit-order-status');
  const direccionInput = el('#edit-order-address');
  const msg = el('#edit-order-msg');
  if (!estadoInput || !direccionInput || !msg) return;
  const estado = estadoInput.value.trim();
  const direccionEnvio = direccionInput.value.trim();
  if (!estado) {
    msg.textContent = 'Selecciona un estado válido.';
    return;
  }
  try {
    await api('/pedidos/' + encodeURIComponent(pendingEditOrderId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, direccionEnvio })
    });
    const modal = bootstrap.Modal.getInstance(el('#editOrderModal'));
    if (modal) modal.hide();
    pendingEditOrderId = null;
    loadDashboard();
  } catch (e) {
    msg.textContent = e.body && e.body.error ? e.body.error : 'Error al guardar el pedido.';
  }
}

function openDeleteOrderModal(order){
  if (!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden eliminar pedidos');
  pendingDeleteOrderId = order._id || order.id || '';
  const nameNode = el('#delete-order-name');
  if (nameNode) nameNode.textContent = order.cliente ? order.cliente.nombre : 'Este pedido';
  const modalEl = document.getElementById('deleteOrderModal');
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  modal.show();
}

async function deleteOrder(id){
  if(!currentUser || !currentUser.isAdmin) return alert('Solo administradores pueden eliminar pedidos');
  const orderId = id || pendingDeleteOrderId || '';
  if (!orderId) return alert('Pedido inválido');
  try{
    await api('/pedidos/'+encodeURIComponent(orderId), { method:'DELETE' });
    pendingDeleteOrderId = null;
    const modal = bootstrap.Modal.getInstance(el('#deleteOrderModal'));
    if (modal) modal.hide();
    loadDashboard();
  }catch(e){ alert(e.body && e.body.error ? e.body.error : 'Error al eliminar pedido') }
}
