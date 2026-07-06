async function api(path, opts){
  const res = await fetch(path, opts);
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (!res.ok) throw { status: res.status, body: data };
  return data;
}

function el(q){return document.querySelector(q)}
function elAll(q){return document.querySelectorAll(q)}

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
    edit.onclick = ()=> editClient(c);
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
    el('#form').reset();
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

document.addEventListener('DOMContentLoaded', ()=>{
  el('#form').addEventListener('submit', submitForm);
  loadClients();
});
