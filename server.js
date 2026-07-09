const path = require('path');
const express = require('express');
const connectDB = require('./db');
const Cliente = require('./models/Cliente');
const Producto = require('./models/Producto');
const Pedido = require('./models/Pedido');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-secret';

function authenticateToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token no proporcionado' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, isAdmin }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Acceso denegado: admin requerido' });
  next();
}

function escapeRegExp(string){
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalizeFirstChar(value){
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeCategory(categoria){
  if (!categoria || typeof categoria !== 'string') return '';
  const value = categoria.toLowerCase().trim();
  const mapping = {
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
  return mapping[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '');
}

// Conectar a MongoDB
connectDB();

// Página de inicio
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Alias para compatibilidad con /form.html
app.get('/form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'formClientes.html'));
});

// Rutas CRUD clientes
app.get('/clientes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const clientes = await Cliente.find();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes', details: err.message });
  }
});

// Auth: register / login
app.post('/auth/register', async (req, res) => {
  try {
    const { nombre, username, email, password, direccion, telefono } = req.body;
    if (!nombre || !username || !email || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });
    const emailNormalized = email.toLowerCase().trim();
    const usernameNormalized = username.toLowerCase().trim();
    const existsEmail = await Cliente.findOne({ email: emailNormalized });
    if (existsEmail) return res.status(409).json({ error: 'Email ya registrado' });
    const existsUser = await Cliente.findOne({ username: usernameNormalized });
    if (existsUser) return res.status(409).json({ error: 'Usuario ya registrado' });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const nuevo = new Cliente({ nombre, username: usernameNormalized, email: emailNormalized, direccion, telefono, passwordHash: hash });
    await nuevo.save();
    const token = jwt.sign({ id: nuevo._id.toString(), email: nuevo.email, username: nuevo.username, isAdmin: !!nuevo.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, cliente: { id: nuevo._id, nombre: nuevo.nombre, email: nuevo.email, username: nuevo.username, isAdmin: nuevo.isAdmin } });
  } catch (err) {
    res.status(400).json({ error: 'Error al registrar', details: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const idValue = (identifier || email || '').toString().trim();
    if (!idValue || !password) return res.status(400).json({ error: 'Faltan campos' });
    const lookup = idValue.toLowerCase();
    const cliente = await Cliente.findOne({ $or: [{ email: lookup }, { username: lookup }] });
    if (!cliente || !cliente.passwordHash) return res.status(401).json({ error: 'Credenciales inválidas' });
    const valid = await bcrypt.compare(password, cliente.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ id: cliente._id.toString(), email: cliente.email, username: cliente.username, isAdmin: !!cliente.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, cliente: { id: cliente._id, nombre: cliente.nombre, email: cliente.email, username: cliente.username, isAdmin: cliente.isAdmin } });
  } catch (err) {
    res.status(400).json({ error: 'Error al iniciar sesión', details: err.message });
  }
});

// Productos
app.get('/productos', async (req, res) => {
  try {
    const productos = await Producto.find();
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos', details: err.message });
  }
});

app.get('/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: 'Error al obtener producto', details: err.message });
  }
});

app.post('/productos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, categoria, precio, stock } = req.body;
    if (!nombre || !categoria || precio === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, categoría, precio y stock' });
    }

    const nombreFormatted = capitalizeFirstChar(nombre.toLowerCase().trim());
    const categoriaFormatted = normalizeCategory(categoria);
    const exists = await Producto.findOne({ nombre: new RegExp(`^${escapeRegExp(nombreFormatted)}$`, 'i') });
    if (exists) {
      return res.status(409).json({ error: 'Producto ya existente', details: 'Ya existe un producto con el mismo nombre' });
    }

    const nuevoProducto = new Producto({
      nombre: nombreFormatted,
      categoria: categoriaFormatted,
      precio,
      stock
    });
    await nuevoProducto.save();
    res.status(201).json(nuevoProducto);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Producto ya existente', details: err.message });
    }
    res.status(400).json({ error: 'Error al crear producto', details: err.message });
  }
});

// Actualizar producto por id
app.put('/productos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.nombre) updates.nombre = capitalizeFirstChar(updates.nombre.toLowerCase().trim());
    if (updates.categoria) {
      updates.categoria = normalizeCategory(updates.categoria);
    }
    delete updates.descripcion;
    const producto = await Producto.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Producto ya existente', details: err.message });
    res.status(400).json({ error: 'Error al actualizar producto', details: err.message });
  }
});

// Eliminar producto por id
app.delete('/productos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByIdAndDelete(id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado', producto });
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar producto', details: err.message });
  }
});

// Pedidos
// Pedidos
app.get('/pedidos', authenticateToken, async (req, res) => {
  try {
    let pedidos;
    if (req.user && req.user.isAdmin) {
      pedidos = await Pedido.find().populate('cliente').populate('items.producto');
    } else {
      pedidos = await Pedido.find({ cliente: req.user.id }).populate('cliente').populate('items.producto');
    }
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos', details: err.message });
  }
});

app.get('/pedidos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findById(id).populate('cliente').populate('items.producto');
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    // Allow admin or owner
    if (!req.user.isAdmin && pedido.cliente._id.toString() !== req.user.id) return res.status(403).json({ error: 'Acceso denegado' });
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: 'Error al obtener pedido', details: err.message });
  }
});

app.post('/pedidos', authenticateToken, async (req, res) => {
  try {
    let { cliente, direccionEnvio, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Campos requeridos: items' });
    }

    // If the user is not admin, force cliente to be authenticated user
    if (!req.user.isAdmin) cliente = req.user.id;

    const clienteExists = await Cliente.findById(cliente);
    if (!clienteExists) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const processedItems = [];
    let total = 0;
    for (const it of items) {
      if (!it.producto || !it.cantidad) return res.status(400).json({ error: 'Cada ítem requiere producto y cantidad' });
      const prod = await Producto.findById(it.producto);
      if (!prod) return res.status(404).json({ error: `Producto no encontrado: ${it.producto}` });
      const cantidad = Number(it.cantidad);
      const precio = Number(prod.precio);
      const subtotal = precio * cantidad;
      processedItems.push({ producto: prod._id, nombre: prod.nombre, cantidad, precio, subtotal });
      total += subtotal;
    }

    const nuevoPedido = new Pedido({
      cliente,
      items: processedItems,
      total,
      direccionEnvio,
      estado: 'pendiente'
    });
    await nuevoPedido.save();
    const populated = await Pedido.findById(nuevoPedido._id).populate('cliente').populate('items.producto');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear pedido', details: err.message });
  }
});

app.put('/pedidos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { direccionEnvio, estado, items } = req.body;
    const updates = {};
    if (direccionEnvio !== undefined) updates.direccionEnvio = direccionEnvio;
    if (estado) updates.estado = estado;
    if (items) {
      // Reprocess items similar to POST
      const processedItems = [];
      let total = 0;
      for (const it of items) {
        if (!it.producto || !it.cantidad) return res.status(400).json({ error: 'Cada ítem requiere producto y cantidad' });
        const prod = await Producto.findById(it.producto);
        if (!prod) return res.status(404).json({ error: `Producto no encontrado: ${it.producto}` });
        const cantidad = Number(it.cantidad);
        const precio = Number(prod.precio);
        const subtotal = precio * cantidad;
        processedItems.push({ producto: prod._id, nombre: prod.nombre, cantidad, precio, subtotal });
        total += subtotal;
      }
      updates.items = processedItems;
      updates.total = total;
    }
    const pedido = await Pedido.findByIdAndUpdate(id, updates, { new: true }).populate('cliente').populate('items.producto');
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar pedido', details: err.message });
  }
});

app.delete('/pedidos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findByIdAndDelete(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ message: 'Pedido eliminado', pedido });
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar pedido', details: err.message });
  }
});

// Obtener cliente por id
app.get('/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    // Only admin or owner can view
    if (!req.user.isAdmin && cliente._id.toString() !== req.user.id) return res.status(403).json({ error: 'Acceso denegado' });
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: 'Error al obtener cliente', details: err.message });
  }
});

// Obtener cliente autenticado
app.get('/clientes/me', authenticateToken, async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.user.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: 'Error al obtener cliente', details: err.message });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const { nombre, username, email, direccion, telefono } = req.body;

    // Validaciones básicas
    if (!nombre || !username || !email) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, usuario y email' });
    }

    const emailNormalized = email.toLowerCase().trim();
    const usernameNormalized = username.toLowerCase().trim();

    // Evitar duplicados por email o username
    const exists = await Cliente.findOne({ $or: [{ email: emailNormalized }, { username: usernameNormalized }] });
    if (exists) {
      return res.status(409).json({ error: 'Email o usuario ya registrado' });
    }

    const nuevo = new Cliente({ nombre, username: usernameNormalized, email: emailNormalized, direccion, telefono });
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (err) {
    // Manejar error de índice único (duplicado) y otros errores de validación
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email ya registrado', details: err.message });
    }
    res.status(400).json({ error: 'Error al crear cliente', details: err.message });
  }
});

// Servidor
// Actualizar cliente por id
app.put('/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Only admin or owner can update
    if (!req.user.isAdmin && req.user.id !== id) return res.status(403).json({ error: 'Acceso denegado' });

    // Validaciones si se envían campos obligatorios
    if (updates.nombre === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }

    // Prevent non-admins from changing isAdmin
    if (updates.isAdmin !== undefined && !req.user.isAdmin) {
      return res.status(403).json({ error: 'No autorizado para cambiar permisos' });
    }

    // Si se actualiza el email, evitar duplicados
    if (updates.email) {
      const emailNormalized = updates.email.toLowerCase().trim();
      const other = await Cliente.findOne({ email: emailNormalized });
      if (other && other._id.toString() !== id) {
        return res.status(409).json({ error: 'Email ya registrado por otro cliente' });
      }
      updates.email = emailNormalized;
    }

    // Si se actualiza el username, evitar duplicados
    if (updates.username) {
      const usernameNormalized = updates.username.toLowerCase().trim();
      const otherU = await Cliente.findOne({ username: usernameNormalized });
      if (otherU && otherU._id.toString() !== id) {
        return res.status(409).json({ error: 'Usuario ya registrado por otro cliente' });
      }
      updates.username = usernameNormalized;
    }

    // If password provided, hash it
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.passwordHash = await bcrypt.hash(updates.password, salt);
      delete updates.password;
    }

    const cliente = await Cliente.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email ya registrado', details: err.message });
    }
    res.status(400).json({ error: 'Error al actualizar cliente', details: err.message });
  }
});

// Eliminar cliente por id
app.delete('/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Only admin or owner can delete
    if (!req.user.isAdmin && req.user.id !== id) return res.status(403).json({ error: 'Acceso denegado' });
    const cliente = await Cliente.findByIdAndDelete(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado', cliente });
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar cliente', details: err.message });
  }
});

// Servidor
app.listen(3000, () => console.log('✅ Servidor en http://localhost:3000'));
