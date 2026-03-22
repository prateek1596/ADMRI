// migrations/run.js
require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  console.log('Running migrations...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
