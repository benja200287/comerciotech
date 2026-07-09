const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  direccion: String,
  telefono: String,
  passwordHash: { type: String },
  isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('Cliente', clienteSchema);
