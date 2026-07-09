const connectDB = require('../db');
const Cliente = require('../models/Cliente');
const bcrypt = require('bcryptjs');

async function main(){
  await connectDB();
  const lookup = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  const q = { $or: [{ username: lookup }, { email: lookup }, { nombre: lookup }] };
  const existing = await Cliente.findOne(q);
  if (existing) {
    console.log('Encontrado documento existente:', existing._id.toString());
    existing.isAdmin = true;
    if (!existing.passwordHash) {
      const salt = await bcrypt.genSalt(10);
      existing.passwordHash = await bcrypt.hash(password, salt);
      console.log('Asignada passwordHash al usuario existente');
    } else {
      console.log('Usuario ya tiene passwordHash; no se modifica');
    }
    await existing.save();
    console.log('Usuario promovido a admin:', existing.username || existing.email || existing.nombre);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const email = lookup.includes('@') ? lookup : `${lookup}@comercio.local`;
  const nuevo = new Cliente({ nombre: 'Administrador', username: lookup, email, passwordHash: hash, isAdmin: true });
  await nuevo.save();
  console.log('Usuario admin creado:', nuevo._id.toString());
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
