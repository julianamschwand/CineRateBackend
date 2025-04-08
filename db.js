const mysql = require("mysql2/promise");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);


const dbOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const db = mysql.createPool(dbOptions);

const createSessionStore = (session) => {
  return new MySQLStore(dbOptions);
};

module.exports = { db, createSessionStore };
