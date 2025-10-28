const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function main() {
  const email = process.argv[2];
  const plainPassword = process.argv[3];

  if (!email || !plainPassword) {
    console.log('Usage: node scripts/checkUserCredentials.js <email> <password>');
    process.exit(1);
  }

  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims';
    await mongoose.connect(uri);
    console.log(`✅ Connected to MongoDB: ${uri}`);

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`❌ User not found for email: ${email}`);
      return;
    }

    console.log('👤 User details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Verified: ${user.isEmailVerified}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Last Login: ${user.lastLogin || 'Never'}`);

    // Compare password using model method
    const match = await user.comparePassword(plainPassword);
    console.log(`\n🔐 Password match: ${match ? '✅ YES' : '❌ NO'}`);

    if (!match) {
      console.log('   Hint: stored hash starts with:', user.password?.substring(0, 20));
    }

    if (match && !user.isEmailVerified) {
      console.log('\n⚠️  Email NOT verified – the login route will block with 401 and requiresEmailVerification=true.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

main();