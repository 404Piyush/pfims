require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment. Aborting.');
      process.exit(1);
    }

    // Connect to the same DB used by the app
    const conn = await connectDB();
    const db = mongoose.connection.db;
    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;
    const port = mongoose.connection.port;

    console.log(`\n⚠️  About to clear ALL data in database '${dbName}' on ${host}:${port}`);

    // Show collections and estimated doc counts before
    const collectionsBefore = await db.listCollections().toArray();
    if (collectionsBefore.length === 0) {
      console.log('📭 No collections found. Database already empty.');
    } else {
      console.log('📚 Collections before clear:');
      for (const c of collectionsBefore) {
        try {
          const count = await db.collection(c.name).estimatedDocumentCount();
          console.log(`  - ${c.name}: ~${count} docs`);
        } catch (e) {
          console.log(`  - ${c.name}: count unavailable`);
        }
      }
    }

    // Drop entire database
    await db.dropDatabase();
    console.log('🗑️  Database dropped successfully.');

    // Verify state after drop
    const collectionsAfter = await db.listCollections().toArray();
    console.log(`📊 Collections after clear: ${collectionsAfter.length}`);
    if (collectionsAfter.length === 0) {
      console.log('✅ Database is now empty.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('💥 Failed to clear database:', error);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
  }
})();