const db = require('../lib/db');
const bcrypt = require('bcryptjs');

async function init() {
  try {
    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created or already exists.');

    // Check if admin user exists
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('password', 10);
      await db.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
      console.log('Test user "admin" created with password "password".');
    } else {
      console.log('Test user "admin" already exists.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

init();
