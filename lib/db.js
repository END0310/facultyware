const mysql = require('mysql2');
require('dotenv').config();

console.log("DB_HOST =", process.env.DB_HOST);
console.log("DB_USER =", process.env.DB_USER);
console.log("DB_NAME =", process.env.DB_NAME);
console.log("DB_PASSWORD =", process.env.DB_PASSWORD);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();

pool.getConnection((err, conn) => {
  if (err) {
    console.error("MYSQL ERROR:", err);
    return;
  }

  console.log("MYSQL CONNECTED");
  conn.release();
});