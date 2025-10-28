const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const ChatSession = require('../models/ChatSession');

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

async function clearForEmail() {
  const email = getArg('email', process.env.SEED_EMAIL);
  if (!email) {
    console.error('❌ Missing --email argument.');
    console.log('\nUsage: node backend/scripts/clearUserDataByEmail.js --email="user@example.com"');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`⚠️  User ${email} not found. Nothing to clear.`);
      return;
    }

    console.log(`\n🧹 Purging data for: ${email}`);

    const [txnRes, budgetRes, catRes, chatRes] = await Promise.all([
      Transaction.deleteMany({ user: user._id }),
      Budget.deleteMany({ user: user._id }),
      Category.deleteMany({ user: user._id }),
      ChatSession.deleteMany({ user: user._id }),
    ]);

    console.log(`   • Deleted ${txnRes.deletedCount} transactions`);
    console.log(`   • Deleted ${budgetRes.deletedCount} budgets`);
    console.log(`   • Deleted ${catRes.deletedCount} categories`);
    console.log(`   • Deleted ${chatRes.deletedCount} chat sessions`);

    const userRes = await User.deleteOne({ _id: user._id });
    console.log(`   • Deleted user document: ${userRes.deletedCount === 1 ? '✅' : '❌'}`);

    console.log('\n✅ Clear complete.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

clearForEmail();