const express = require("express")
const session = require("express-session")
const cors = require("cors")
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
require("dotenv").config()

const {
  isloggedin,
  userdata,
  getallusers,
  register,
  login,
  logout,
  rolemod,
  roleadmin,
  roleuser,
  edituser,
  deleteuser,
  changeselectedlanguage
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

const { getrating, rate, getuserrating } = require("./handlers/ratingHandlers")

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
  origin: process.env.ORIGIN_URL,
  credentials: true,
}))

app.set('trust proxy', 2)

const sessionStore = createSessionStore(session);

const isProd = process.env.NODE_ENV == "production"

app.use(
  session({
    key: "SessionId",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: isProd, 
      httpOnly: true, 
      sameSite: "lax", 
      maxAge: 1000 * 60 * 60 * 24 * 7
    },
  })
)

app.use("/posters", express.static(path.join(__dirname, "posters")))

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "/posters");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

//////////////////////////////////////////

//Users

app.get("/isloggedin", isloggedin)
app.get("/userdata", userdata)
app.get("/getallusers", getallusers)
app.post("/register", register)
app.post("/login", login)
app.post("/logout", logout)
app.post("/rolemod", rolemod)
app.post("/roleadmin", roleadmin)
app.post("/roleuser", roleuser)
app.patch("/edituser", edituser)
app.delete("/deleteuser", deleteuser)
app.post("/changeselectedlanguage", changeselectedlanguage)

//Movies

app.post("/addmovie", upload.single("poster"), addmovie)
app.get("/getmovies", getmovies)
app.get("/getmoviedata", getmoviedata)
app.get("/getallmoviedata", getallmoviedata)
app.patch("/editmovie", upload.single("poster"), editmovie)
app.delete("/deletemovie", deletemovie)

//Languages

app.get("/getlanguages", getlanguages)

//Ratings

app.get("/getrating", getrating)
app.get("/getuserrating", getuserrating)
app.post("/rate", rate)

//Comments

app.get("/getcomments", getcomments)
app.post("/addcomment", addcomment)
app.patch("/editcomment", editcomment)
app.delete("/deletecomment", deletecomment)

//////////////////////////////////////////

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`))