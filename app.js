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
  if (!username || !email || !password ) return res.status(400).json({error: "Missing data"})      
  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await db.query("insert into UserData (Username, Email, UserPassword) values (?,?,?)", [username, email, hashedPassword])
    req.session.user = { id: result.insertId, username: username, email: email }
    res.status(200).json({message: "User registered successfully", userId: result.insertId})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "An Error happend while registering"})
  }
})

app.post('/login', async (req, res) => {
  const {email, password} = req.body
  if (!email || !password) return res.status(400).json({error: "Missing data"})
  try {
    let [user] = await db.query("select * from UserData where Email = ?", [email])
    if (user.length === 0) return res.status(401).json({error: "Not a valid user"})
    user = user[0]

    const isPasswordValid = await bcrypt.compare(password, user.UserPassword)
    if (!isPasswordValid) return res.status(401).json({error: "Wrong password"})

    req.session.user = { id: user.UserDataId, username: user.Username, email: email }
    res.status(200).json({message: "User successfully logged in"})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "Error while logging in"})
  }
})

app.get('/userdata', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    let [user] = await db.query("select * from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]

    res.status(200).json({id: user.UserDataId, username: user.Username, email: user.Email, role: user.UserRole})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "Error retrieving data from the database"})
  }
})

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) return res.status(500).json({ message: 'Logout failed' })
      res.clearCookie('SessionId')
      res.json({ message: 'Logged out successfully' })
  })
})

app.post('/rolemod', async (req, resg) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({message: "Missing data"})
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (updatinguser.length === 0) return res.status(401).json({error: "Not a valid user"})
    updatinguser = updatinguser[0]

    if (user.UserRole !== "admin" || updatinguser.UserRole === "admin") return res.status(403).json({error: "Forbidden"})
    
    try {
      await db.query("update UserData set UserRole = 'mod' where UserDataId = ?", [userdataid])
      res.status(200).json({message: `Successfully made '${updatinguser.Username}' a moderator`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({error: "Error while updating the database"})
    }
    
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "Error while checking the users role"})
  }
})

app.post('/roleadmin', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({message: "Missing data"})
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' })
 
  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select Username from UserData where UserDataId = ?", [userdataid])
    if (updatinguser.length === 0) return res.status(401).json({error: "Not a valid user"})
    updatinguser = updatinguser[0]

    if (user[0] !== "admin") return res.status(403).json({error: "Forbidden"})

    try {
      await db.query("update UserData set UserRole = 'admin' where UserDataId = ?", [userdataid])
      res.status(200).json({message: `Successfully made '${updatinguser[0].Username}' an admin`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({error: "Error while updating the database"})
    }
  } catch (error) {
    res.status(500).json({error: "Error while checking the users role"})
  }
})

app.post('/roleuser', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({message: "Missing data"})
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (updatinguser.length === 0) return res.status(401).json({error: "Not a valid user"})
    updatinguser = updatinguser[0]

    if (user.UserRole !== "admin" || updatinguser.UserRole === "admin") return res.status(403).json({error: "Forbidden"})

    try {
      await db.query("update UserData set UserRole = 'user' where UserDataId = ?", [userdataid])
      res.status(200).json({message: `Successfully made '${updatinguser[0].Username}' a user`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({error: "Error while updating the database"})
    }
    
  } catch (error) {
    res.status(500).json({error: "Error while checking the users role"})
  }
})

app.post('/deleteuser', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({message: "Missing data"})
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [deletinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (deletinguser.length === 0) return res.status(401).json({error: "Not a valid user"})
    deletinguser = deletinguser[0]

    if (user[0].UserRole !== "admin" || deletinguser[0].UserRole === "admin") return res.status(403).json({error: "Forbidden"})
    
    try {
      await db.query("delete from UserData where UserDataId = ?", [userdataid])
      res.status(200).json({message: `Successfully deleted '${deletinguser[0].Username}'`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({error: "Error while deleting from the database"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "Error while checking the users role"})
  }
})

app.post('/addmovie', async (req, res) => {
  const {title, description, poster, playbackid} = req.body 
  if (!title || !description || !poster || !playbackid) return res.status(400).json({error: "Missing data"})
  if (!req.session.user) return res.status(401).json({error: "Unauthorized"})
  
  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]

    if (user.UserRole !== "admin" && user.UserRole !== "mod") return res.status(403).json({error: "Forbidden"})

    try {
      let [languagecodes] = await db.query("select LanguageCode from Languages")
      languagecodes = languagecodes.map(lang => lang.LanguageCode)
      try {
        const [result] = await db.query("insert into Movies (PlaybackId, Poster) values (?,?)", [playbackid, poster])
        const movieid = result.insertId

        try {
          for (const lang of languagecodes) {
            if (title.hasOwnProperty(lang) && description.hasOwnProperty(lang)) {
              let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [lang])
              languageid = languageid[0]
              
              await db.query("insert into MovieTranslations (Title, MovieDescription, fk_LanguageId, fk_MovieId) values (?,?,?,?)", [title[lang], description[lang], languageid[0].LanguageId, movieid])
            }
          }
          res.status(200).json({message: "Successfully inserted the movie"})
        } catch (error) {
          console.error("Error:", error)
          res.status(500).json({error: "Error while inserting the movie translations into the database"})
        }
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({error: "Error while inserting the movie into the database"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({error: "Error while retrieving languages"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({error: "Error while checking the users role"})
  }
})

//////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));