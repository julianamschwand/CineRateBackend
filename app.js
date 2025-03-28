const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
app.use(express.json());

// MySQL-Verbindung
const dbOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const sessionStore = new MySQLStore(dbOptions);
const db = mysql.createPool(dbOptions);

// Session Middleware
app.use(
  session({
    key: "SessionId",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 },
  })
);

//////////////////////////////////////////

app.post('/register', async (req, res) => {
  const {username, email, password} = req.body
  if (!username || !email || !password ) {
    return res.status(400).json({error: "missing data"})
  }       

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await db.query("insert into UserData (Username, Email, UserPassword) values (?,?,?)", [username, email, hashedPassword])
    res.status(200).json({message: "User registered successfully", userId: result.insertId})
  } catch (error) {
    res.status(500).json({message: "An Error happend while registering"})
  }
})

app.get('/ping', async (req, res) => {
  return res.status(200).json({message: "Pong"})
})

//////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
