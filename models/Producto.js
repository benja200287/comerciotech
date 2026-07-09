const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    set: value => {
      if (!value) return value;
      const text = value.toString().trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
    }
  },
  categoria: { type: String, required: true, trim: true, lowercase: true },
  precio: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  creadoEn: { type: Date, default: Date.now }
}, {
  toObject: { getters: true },
  toJSON: { getters: true }
});

productoSchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model('Producto', productoSchema);
