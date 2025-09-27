const mongoose = require('mongoose');
require('dotenv').config();

async function fixUserIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check current indexes
    console.log('Current indexes on users collection:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(index => {
      console.log('- Index:', JSON.stringify(index.key), 'Name:', index.name);
    });

    // Drop the problematic username_1 index if it exists
    try {
      await usersCollection.dropIndex('username_1');
      console.log('✅ Successfully dropped username_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  username_1 index does not exist (already removed)');
      } else {
        console.log('❌ Error dropping username_1 index:', error.message);
      }
    }

    // Show remaining indexes
    console.log('\nRemaining indexes after cleanup:');
    const remainingIndexes = await usersCollection.indexes();
    remainingIndexes.forEach(index => {
      console.log('- Index:', JSON.stringify(index.key), 'Name:', index.name);
    });

    console.log('\n✅ Database index cleanup completed!');
    console.log('You should now be able to register new users.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the fix
fixUserIndexes();