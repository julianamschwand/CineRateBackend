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
  if (!username || !email || !password ) return res.status(400).json({success: false, error: "Missing data"})   
  try {
    const [dbusername] = db.query("select * from UserData where Username = ?", [username])
    const [dbemail] = db.query("select * from UserData where Email = ?", [email])

    if (dbusername.length !== 0) return res.status(400).json({success: false, error: "Username is taken"})
    if (dbemail.length !== 0) return res.status(400).json({success: false, error: "E-Mail is taken"})

    try {
      const hashedpassword = await bcrypt.hash(password, 10)
      const result = await db.query("insert into UserData (Username, Email, UserPassword) values (?,?,?)", [username, email, hashedpassword])
      req.session.user = { id: result.insertId, username: username, email: email }
      res.status(200).json({success: true, message: "User registered successfully", userId: result.insertId})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while registering"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching data from database"})
  }
})

app.post('/login', async (req, res) => {
  const {email, password} = req.body
  if (!email || !password) return res.status(400).json({success: false, error: "Missing data"})
  try {
    let [user] = await db.query("select * from UserData where Email = ?", [email])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    user = user[0]

    const isPasswordValid = await bcrypt.compare(password, user.UserPassword)
    if (!isPasswordValid) return res.status(401).json({success: false, error: "Wrong password"})

    req.session.user = { id: user.UserDataId, username: user.Username, email: email }
    res.status(200).json({success: true, message: "User successfully logged in"})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while logging in"})
  }
})

app.get('/userdata', async (req, res) => {
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    let [user] = await db.query("select * from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]

    res.status(200).json({id: user.UserDataId, username: user.Username, email: user.Email, role: user.UserRole})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error retrieving data from the database"})
  }
})

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) return res.status(500).json({success: false, message: 'Logout failed'})
      res.clearCookie('SessionId')
      res.status(200).json({success: true, message: 'Logged out successfully'})
  })
})

app.post('/rolemod', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({success: false, message: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    updatinguser = updatinguser[0]

    if (user.UserRole !== "admin" || updatinguser.UserRole === "admin") return res.status(403).json({success: false, error: "Forbidden"})
    
    try {
      await db.query("update UserData set UserRole = 'mod' where UserDataId = ?", [userdataid])
      res.status(200).json({success: true, message: `Successfully made '${updatinguser.Username}' a moderator`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while updating the database"})
    }
    
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while checking the users role"})
  }
})

app.post('/roleadmin', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({success: false, message: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})
 
  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select Username from UserData where UserDataId = ?", [userdataid])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    updatinguser = updatinguser[0]

    if (user[0] !== "admin") return res.status(403).json({success: false, error: "Forbidden"})

    try {
      await db.query("update UserData set UserRole = 'admin' where UserDataId = ?", [userdataid])
      res.status(200).json({success: true, message: `Successfully made '${updatinguser[0].Username}' an admin`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while updating the database"})
    }
  } catch (error) {
    res.status(500).json({success: false, error: "Error while checking the users role"})
  }
})

app.post('/roleuser', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({success: false, message: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [updatinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    updatinguser = updatinguser[0]

    if (user.UserRole !== "admin" || updatinguser.UserRole === "admin") return res.status(403).json({success: false, error: "Forbidden"})

    try {
      await db.query("update UserData set UserRole = 'user' where UserDataId = ?", [userdataid])
      res.status(200).json({success: true, message: `Successfully made '${updatinguser[0].Username}' a user`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while updating the database"})
    }
    
  } catch (error) {
    res.status(500).json({success: false, error: "Error while checking the users role"})
  }
})

app.delete('/deleteuser', async (req, res) => {
  const {userdataid} = req.body
  if (!userdataid) return res.status(400).json({success: false, message: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [deletinguser] = await db.query("select UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    deletinguser = deletinguser[0]

    if ((user.UserRole !== "admin" && user.UserRole !== "mod") || deletinguser.UserRole === "admin") return res.status(403).json({success: false, error: "Forbidden"})
    
    try {
      await db.query("delete from UserData where UserDataId = ?", [userdataid])
      await db.query("delete sessions where data like ?", [`%"id":${userdataid}%`]);
      res.status(200).json({success: true, message: `Successfully deleted '${deletinguser.Username}'`})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while deleting the user from the database"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while checking the users role"})
  }
})

app.post('/addmovie', async (req, res) => {
  const {title, description, poster, playbackid} = req.body 
  if (!title || !description || !poster || !playbackid) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})
  
  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]

    if ((user.UserRole !== "admin" && user.UserRole !== "mod") || deletinguser.UserRole === "admin") return res.status(403).json({success: false, error: "Forbidden"})

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
              languageid = languageid[0].LanguageId

              await db.query("insert into MovieTranslations (Title, MovieDescription, fk_LanguageId, fk_MovieId) values (?,?,?,?)", [title[lang], description[lang], languageid, movieid])
            }
          }
          res.status(200).json({success: true, message: "Successfully inserted the movie"})
        } catch (error) {
          console.error("Error:", error)
          res.status(500).json({success: false, error: "Error while inserting the movie translations into the database"})
        }
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while inserting the movie into the database"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while retrieving languages"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while checking the users role"})
  }
})

app.get('/getmovies', async (req, res) => {
  const {languagecode} = req.body
  if (!languagecode) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [languagecode])
    languageid = languageid[0].LanguageId
    try {
      const [movies] = await db.query("select MovieId, Title, MovieDescription, PlaybackId, Poster from Movies join MovieTranslations on MovieId = fk_MovieId where fk_LanguageId = ?", [languageid])
      res.status(200).json({success: true, movies: movies})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching movies"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching the language id"})
  }
})

app.patch('/edituser', async (req, res) => {
  const {username, email, password} = req.body
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    const [dbusername] = db.query("select * from UserData where Username = ?", [username])
    const [dbemail] = db.query("select * from UserData where Email = ?", [email])

    if (dbusername.length !== 0) return res.status(400).json({success: false, error: "Username is taken"})
    if (dbemail.length !== 0) return res.status(400).json({success: false, error: "E-Mail is taken"})
    
    try {
      if (username) await db.query("update UserData set Username = ? where UserDataId = ?", [username, req.session.user.id])
      if (email) await db.query("update UserData set Email = ? where UserDataId = ?", [email, req.session.user.id])
      if (password) await db.query("update UserData set UserPassword = ? where UserDataId = ?", [password, req.session.user.id])
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while updating the database"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching data from database"})
  }
})

//////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));