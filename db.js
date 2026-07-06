const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect('mongodb://usuario:usuario123@127.0.0.1:27017/comerciotech?authSource=comerciotech');
    console.log('✅ Conectado a MongoDB');
  } catch (err) {
    console.error('❌ Error de conexión:', err);
  }
}

module.exports = connectDB;
