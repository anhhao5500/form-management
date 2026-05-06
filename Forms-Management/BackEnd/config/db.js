const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "form_management",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 30000,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ DB connection failed:", err.message);
    console.error("❌ Code:", err.code);
  } else {
    console.log("✅ Connected to MySQL (Pool)");
    connection.release();
  }
});

// ✅ Helper transaction
pool.transaction = (callback) => {
  pool.getConnection((err, connection) => {
    if (err) return callback(err);
    connection.beginTransaction((errTx) => {
      if (errTx) {
        connection.release();
        return callback(errTx);
      }
      callback(null, connection);
    });
  });
};

module.exports = pool;