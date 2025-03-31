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
    return res.status(400).json({error: "Missing data"})
  }       

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await db.query("insert into UserData (Username, Email, UserPassword) values (?,?,?)", [username, email, hashedPassword])
    req.session.user = { id: result.insertId, username: username, email: email }
    res.status(200).json({message: "User registered successfully", userId: result.insertId})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({message: "An Error happend while registering"})
  }
})

app.post('/login', async (req, res) => {
  const {email, password} = req.body
  if (!email || !password) {
    return res.status(400).json({error: "Missing data"})
  }

  try {
    const [results] = await db.query("select * from UserData where Email = ?", [email])
    if (results.length === 0) {
      return res.status(401).json({error: "No valid user"})
    }
    
    const user = results[0]
    const isPasswordValid = await bcrypt.compare(password, user.UserPassword)

    if (!isPasswordValid) {
      return res.status(401).json({error: "Wrong password"})
    }
    req.session.user = { id: user.UserDataId, username: user.Username, email: email }
    res.status(200).json({message: "User successfully logged in"})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "An error happened while logging in"})
  }
})

app.get('/userdata', async (req, res) => {
  if (req.session.user) {
    return res.status(200).json({id: req.session.user.id, username: req.session.user.username, email: req.session.user.email})
  }
  res.status(401).json({ message: 'Unauthorized' })
})

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ message: 'Logout failed' })
      }
      res.clearCookie('SessionId')
      res.json({ message: 'Logged out successfully' })
  });
});

app.post('/makemod', async (req, res) => {
  const {userdataid} = req.body
  if (!req.session.user) {
    if (!userdataid) {
      return res.status(400).json({message: "Missing data"})
    }
    
    try {
      const [results] = db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
      
      if (results[0] === "admin"){
        try {

        } catch (error) {
          
        }
      }
    } catch (error) {

    }
  } 
  res.status(401).json({ message: 'Unauthorized' })
})
app.post('/makeadmin', async (req, res) => {

})

//////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
