const mongoose = require('mongoose');

const pedidoItemSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  nombre: { type: String, required: true, trim: true },
  cantidad: { type: Number, required: true, min: 1, default: 1 },
  precio: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 }
});

const pedidoSchema = new mongoose.Schema({
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true
  },
  items: {
    type: [pedidoItemSchema],
    required: true,
    validate: {
      validator: (value) => Array.isArray(value) && value.length > 0,
      message: 'El pedido debe contener al menos un ítem'
    }
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  direccionEnvio: {
    type: String,
    trim: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'pagado', 'enviado', 'cancelado'],
    default: 'pendiente'
  },
  creadoEn: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Pedido', pedidoSchema);
