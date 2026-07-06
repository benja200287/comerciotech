const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  direccion: String,
  telefono: String
});

module.exports = mongoose.model('Cliente', clienteSchema);
