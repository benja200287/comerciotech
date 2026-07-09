const connectDB = require('../db');
const Cliente = require('../models/Cliente');
const bcrypt = require('bcryptjs');

async function main(){
  await connectDB();
  const lookup = process.argv[2] || 'admin';
  const newPass = process.argv[3] || 'admin123';
  const c = await Cliente.findOne({ $or: [{ username: lookup }, { email: lookup }, { nombre: lookup }] });
  if (!c) {
    console.error('No encontrado usuario app con lookup:', lookup);
    process.exit(1);
  }
  const salt = await bcrypt.genSalt(10);
  c.passwordHash = await bcrypt.hash(newPass, salt);
  c.isAdmin = true;
  await c.save();
  console.log('Password reseteada para:', c.username || c.email || c.nombre);
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
