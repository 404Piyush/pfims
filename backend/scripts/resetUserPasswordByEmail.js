const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');

function getArg(name, defaultVal) {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.split('=')[1];
    }
  }
  return defaultVal;
}

async function run() {
  const email = getArg('email', process.env.SEED_EMAIL);
  const newPassword = getArg('password', 'password123');

  if (!email) {
    console.error('❌ Missing --email argument.');
    console.log('\nUsage: node backend/scripts/resetUserPasswordByEmail.js --email="user@example.com" [--password=NewPass]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`❌ User ${email} not found`);
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });
    console.log(`🔐 Password updated for ${email}`);

    const updated = await User.findOne({ email }).select('+password');
    const isMatch = await bcrypt.compare(newPassword, updated.password);
    console.log(isMatch ? '✅ Password verification successful!' : '❌ Password verification failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

run();