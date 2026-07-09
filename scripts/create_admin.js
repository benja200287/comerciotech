const connectDB = require('../db');
const Cliente = require('../models/Cliente');
const bcrypt = require('bcryptjs');

async function main(){
  await connectDB();
  const email = process.argv[2] || 'admin@comercio.local';
  const password = process.argv[3] || 'Admin1234';
  const nombre = process.argv[4] || 'Administrador';
  // derive username from email local-part if not provided
  const usernameArg = process.argv[5];

  const normalizedEmail = email.toLowerCase().trim();
  const defaultUsername = usernameArg || normalizedEmail.split('@')[0] || 'admin';
  const usernameNormalized = defaultUsername.toLowerCase().trim();
  const existing = await Cliente.findOne({ email: normalizedEmail });
  if (existing) {
    console.log('Usuario existente encontrado:', normalizedEmail);
    existing.isAdmin = true;
    if (!existing.username) existing.username = usernameNormalized;
    if (!existing.passwordHash) {
      const salt = await bcrypt.genSalt(10);
      existing.passwordHash = await bcrypt.hash(password, salt);
      console.log('Password asignada al usuario existente.');
    }
    await existing.save();
    console.log('Usuario marcado como admin:', normalizedEmail);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const admin = new Cliente({ nombre, username: usernameNormalized, email: normalizedEmail, passwordHash: hash, isAdmin: true });
  await admin.save();
  console.log('Admin creado:', normalizedEmail);
  console.log('Password temporal:', password);
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
