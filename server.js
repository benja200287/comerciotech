const path = require('path');
const express = require('express');
const connectDB = require('./db');
const Cliente = require('./models/Cliente');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Conectar a MongoDB
connectDB();

// Ruta raíz redirige al formulario
app.get('/', (req, res) => {
  res.redirect('/form.html');
});

// Rutas CRUD
app.get('/clientes', async (req, res) => {
  try {
    const clientes = await Cliente.find();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes', details: err.message });
  }
});

// Obtener cliente por id
app.get('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: 'Error al obtener cliente', details: err.message });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const { nombre, email, direccion, telefono } = req.body;

    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Campos requeridos: nombre y email' });
    }

    // Evitar duplicados por email
    const exists = await Cliente.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    const nuevo = new Cliente({ nombre, email, direccion, telefono });
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
app.put('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validaciones si se envían campos obligatorios
    if (updates.nombre === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
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
app.delete('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findByIdAndDelete(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado', cliente });
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar cliente', details: err.message });
  }
});

// Servidor
app.listen(3000, () => console.log('✅ Servidor en http://localhost:3000'));
