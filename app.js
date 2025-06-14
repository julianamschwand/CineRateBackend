const express = require("express")
const session = require("express-session")
const MySQLStore = require("express-mysql-session")(session)
const mysql = require("mysql2/promise")
const bcrypt = require("bcrypt")
const cors = require("cors")
require("dotenv").config()

const {
  userdata,
  register,
  login,
  logout,
  rolemod,
  roleadmin,
  roleuser,
  edituser,
  deleteuser
} = require("./handlers/userHandlers.js")

const {
  addmovie,
  getmovies,
  getmoviedata,
  getallmoviedata,
  editmovie,
  deletemovie,
} = require("./handlers/movieHandlers")

const { getlanguages } = require("./handlers/languageHandlers")

const { getrating, rate } = require("./handlers/ratingHandlers")

const {
  getcomments,
  addcomment,
  editcomment,
  deletecomment,
} = require("./handlers/commentHandlers")

const { createSessionStore } = require("./db")

const app = express()
app.use(express.json())
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}))


const sessionStore = createSessionStore(session);

app.use(
  session({
    key: "SessionId",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, 
      httpOnly: true, 
      sameSite: "Lax", 
      maxAge: 1000 * 60 * 60 
    },
  })
)

//////////////////////////////////////////

//Users

app.get("/userdata", userdata)
app.post("/register", register)
app.post("/login", login)
app.post("/logout", logout)
app.post("/rolemod", rolemod)
app.post("/roleadmin", roleadmin)
app.post("/roleuser", roleuser)
app.patch("/edituser", edituser)
app.delete("/deleteuser", deleteuser)

//Movies

app.post("/addmovie", addmovie)
app.get("/getmovies", getmovies)
app.get("/getmoviedata", getmoviedata)
app.get("/getallmoviedata", getallmoviedata)
app.patch("/editmovie", editmovie)
app.delete("/deletemovie", deletemovie)

//Languages

app.get("/getlanguages", getlanguages)

//Ratings

app.get("/getrating", getrating)
app.post("/rate", rate)

//Comments

app.get("/getcomments", getcomments)
app.post("/addcomment", addcomment)
app.patch("/editcomment", editcomment)
app.delete("/deletecomment", deletecomment)

//////////////////////////////////////////

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`))