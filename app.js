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
    const [dbusername] = await db.query("select * from UserData where Username = ?", [username])
    const [dbemail] = await db.query("select * from UserData where Email = ?", [email])

    if (dbusername.length !== 0) return res.status(400).json({success: false, error: "Username is taken"})
    if (dbemail.length !== 0) return res.status(400).json({success: false, error: "E-Mail is taken"})

    try {
      const hashedpassword = await bcrypt.hash(password, 10)
      const [result] = await db.query("insert into UserData (Username, Email, UserPassword) values (?,?,?)", [username, email, hashedpassword])
      req.session.user = { id: result.insertId }
      res.status(200).json({success: true, message: "User registered successfully", userdataid: result.insertId})
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

    req.session.user = { id: user.UserDataId }
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
    let [user] = await db.query("select UserDataId, UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [deletinguser] = await db.query("select UserDataId, UserRole, Username from UserData where UserDataId = ?", [userdataid])
    if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
    deletinguser = deletinguser[0]

    if ((user.UserRole !== "admin" && user.UserRole !== "mod" && user.UserDataId !== deletinguser.UserDataId) || deletinguser.UserRole === "admin") return res.status(403).json({success: false, error: "Forbidden"})
    
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

    if (user.UserRole !== "admin" && user.UserRole !== "mod") return res.status(403).json({success: false, error: "Forbidden"})

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
      let [movies] = await db.query("select MovieId, coalesce(Title, (select Title from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Title', coalesce(MovieDescription, (select MovieDescription from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Description', PlaybackId, Poster from Movies left join MovieTranslations on MovieId = fk_MovieId and fk_LanguageId = ?", [languageid])
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
    const [dbusername] = await db.query("select * from UserData where Username = ?", [username])
    const [dbemail] = await db.query("select * from UserData where Email = ?", [email])

    if (dbusername.length !== 0) return res.status(400).json({success: false, error: "Username is taken"})
    if (dbemail.length !== 0) return res.status(400).json({success: false, error: "E-Mail is taken"})
    
    try {
      if (username) await db.query("update UserData set Username = ? where UserDataId = ?", [username, req.session.user.id])
      if (email) await db.query("update UserData set Email = ? where UserDataId = ?", [email, req.session.user.id])
      if (password) {
        const hashedpassword = await bcrypt.hash(password, 10)
        await db.query("update UserData set UserPassword = ? where UserDataId = ?", [hashedpassword, req.session.user.id])
      }
      
      res.status(200).json({success: true, message: "Successfully updated the user"})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while updating the database"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching data from database"})
  }
})

app.get("/getmoviedata", async (req, res) => {
  const {movieid, languagecode} = req.body
  if (!movieid || !languagecode) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [movie] = await db.query("select * from Movies where MovieId = ?", [movieid])
    if (movie.length === 0) return res.status(404).json({succes: false, error: "Movie not found"})

    try {
      let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [languagecode])
      languageid = languageid[0].LanguageId

      try {
        let [movie] = await db.query("select MovieId, Title, MovieDescription, PlaybackId, Poster from Movies join MovieTranslations on MovieId = fk_MovieId where fk_LanguageId = ? and MovieId = ?", [languageid, movieid])
        movie = movie[0]
        res.status(200).json({success: true, movie: movie})
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while fetching the movie"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching the language id"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while getching the movie ID"})
  }
})

app.get("/getallmoviedata", async (req, res) => {
  const {movieid} = req.body
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})
  
  try {
    let [movie] = await db.query("select * from Movies where MovieId = ?", [movieid])
    if (movie.length === 0) return res.status(404).json({succes: false, error: "Movie not found"})

    try {
      const [languageids] = await db.query("select fk_LanguageId from MovieTranslations where fk_MovieId = ?", [movieid])

      try {
        let languagecodes = []

        for (lang of languageids) {
          const [result] = await db.query("select LanguageCode from Languages where LanguageId = ?", [lang.fk_LanguageId])
          languagecodes.push(result[0].LanguageCode)
        }

        try {
          let [titles] = await db.query("select Title from MovieTranslations where fk_MovieId = ?", [movieid])
          let [descriptions] = await db.query("select MovieDescription from MovieTranslations where fk_MovieId = ?", [movieid])

          try {
            let titlelanguages = ""
            let descriptionlanguages = ""
            let index = 0
            languagecodes.forEach((code) => {
              titlelanguages += `'${code}', '${titles[index].Title}',`
              descriptionlanguages += `'${code}', '${descriptions[index].MovieDescription}',`
              index++
            })
            titlelanguages = titlelanguages.slice(0,-1)
            descriptionlanguages = descriptionlanguages.slice(0,-1)
    
            const moviequery = `select MovieId, json_object(${titlelanguages}) as Title, json_object(${descriptionlanguages}) as Description, PlaybackId, Poster from Movies join MovieTranslations on MovieId = fk_MovieId where MovieId = ?`
  
            let [movie] = await db.query(moviequery, [movieid]) 

            movie[0].Title = JSON.parse(movie[0].Title);
            movie[0].Description = JSON.parse(movie[0].Description);  

            res.status(200).json({success: true, movie: movie[0]})
          } catch (error) {
            console.error("Error:", error)
            res.status(500).json({success: false, error: "Error while fetching the movie"})
          }
        } catch (error) {
          console.error("Error:", error)
          res.status(500).json({success: false, error: "Error while fetching translations"})
        }
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while fetching the language codes"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching the available language IDs"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while getching the movie ID"})
  }
})

app.get("/getlanguages", async (req, res) => {
  try {
    const [languages] = await db.query("select * from Languages")
    res.status(200).json({success: true, languages: languages})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching languages from the database"})
  }
}) 

app.patch("/editmovie", async (req, res) => {
  const {movieid, title, description, playbackid, poster} = req.body
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})
  
    try {
      let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
      user = user[0]
      if (user.UserRole !== "admin" && user.UserRole !== "mod") return res.status(403).json({success: false, error: "Forbidden"})
  
      try {
        let [movie] = await db.query("select * from Movies where MovieId = ?", [movieid])
        if (movie.length === 0) return res.status(404).json({succes: false, error: "Movie not found"})

        try {
          let [languagecodes] = await db.query("select LanguageCode from Languages")
          languagecodes = languagecodes.map(lang => lang.LanguageCode)

          try {
            if (playbackid) {
              await db.query("update Movies set PlaybackId = ? where MovieId = ?", [playbackid, movieid])
            }
            if (poster) {
              await db.query("update Movies set Poster = ? where MovieId = ?", [poster, movieid])
            }
            if (title) {
              for (const lang of languagecodes) {
                if (title.hasOwnProperty(lang)) {
                  let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [lang])
                  languageid = languageid[0].LanguageId

                  const [titles] = await db.query("select * from MovieTranslations where fk_MovieId = ? and fk_LanguageId = ?", [movieid, languageid])

                  if (titles.length === 0) {
                    await db.query("insert into MovieTranslations (Title, fk_MovieId, fk_LanguageId) values (?,?,?)", [title[lang], movieid, languageid])
                  } else {
                    await db.query("update MovieTranslations set Title = ? where fk_MovieId = ? and fk_LanguageId = ?", [title[lang], movieid, languageid])
                  }
                }
              }
            }
            if (description) {
              for (const lang of languagecodes) {
                if (description.hasOwnProperty(lang)) {
                  let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [lang])
                  languageid = languageid[0].LanguageId

                  const [descriptions] = await db.query("select * from MovieTranslations where fk_MovieId = ? and fk_LanguageId = ?", [movieid, languageid])

                  if (descriptions.length === 0) {
                    await db.query("insert into MovieTranslations (MovieDescription, fk_MovieId, fk_LanguageId) values (?,?,?)", [description[lang], movieid, languageid])
                  } else {
                    await db.query("update MovieTranslations set MovieDescription = ? where fk_MovieId = ? and fk_LanguageId = ?", [description[lang], movieid, languageid])
                  }
                }
              }
            }
            res.status(200).json({success: true, message: "Successfully updated the movie"})
          } catch (error) {
            console.error("Error:", error)
            res.status(500).json({success: false, error: "Error while updating the movie"})
          }
        } catch (error) {
          console.error("Error:", error)
          res.status(500).json({success: false, error: "Error while fetching languages"})
        }
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while fetching the movie ID"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching userrole"})
    }
})

app.delete("/deletemovie", async (req, res) => {
  const {movieid} = req.body
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    if (user.UserRole !== "admin" && user.UserRole !== "mod") return res.status(403).json({success: false, error: "Forbidden"})

    try {
      let [movie] = await db.query("select * from Movies where MovieId = ?", [movieid])
      if (movie.length === 0) return res.status(404).json({succes: false, error: "Movie not found"})

      try {
        await db.query("delete from Movies where MovieId = ?", [movieid])
        res.status(200).json({success: true, message: "Successfully deleted the movie"})
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while deleting the movie"})
      }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching the movie ID"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching userrole"})
  }

})

app.get("/getrating", async (req, res) => {
  const {movieid} = req.body
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [rating] = await db.query("select round(avg(RatingValue), 2) as 'Rating' from Ratings where fk_MovieId = ? group by RatingValue", [movieid])
    if (rating.lenght === 0) return res.status(404).json({success: false, rating: "No rating"})
    rating = rating[0].Rating

    res.status(200).json({success: true, rating: rating})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error fetching rating"})
  }
})

app.get("/getcomments", async (req, res) => {
  const {movieid} = req.body
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})

  try {
    const [comments] = await db.query("select CommentId, Content, (select Username from UserData where UserDataId = fk_UserDataId) as 'Username' from Comments") 
    if (comments.length === 0) return res.status(404).json({success: false, rating: "No comments"})

    res.status(200).json({success: true, comments: comments})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error fetching comments"})
  }
})

app.post("/rate", async (req,res) => {
  const {movieid, rating} = req.body
  if (!movieid || !rating) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})

  try {
    const [ratings] = await db.query("select * from Ratings where fk_MovieId = ? and fk_UserDataId = ?", [movieid, req.session.user.id])

    try {
      if (ratings.length === 0) {
        await db.query("insert into Ratings (RatingValue, fk_UserDataId, fk_MovieId) values (?,?,?)", [rating, req.session.user.id, movieid])
      } else {
        await db.query("update Ratings set RatingValue = ? where fk_UserDataId = ? and fk_MovieId = ?", [rating, req.session.user.id, movieid])
      }

      res.status(200).json({success: true, message: "Sucessfully rated the movie"})
    } catch {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error inserting / updating the rating"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error fetching ratings"})
  }
})

app.post("/addcomment", async (req,res) => {
  const {movieid, content} = req.body
  if (!movieid || !content) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})

  try {
    await db.query("insert into Comments (Content, fk_UserDataId, fk_MovieId) values (?,?,?)", [content, req.session.user.id, movieid])
    
    res.status(200).json({success: true, message: "Sucessfully commented on the movie"})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error inserting the comment"})
  }
})

app.patch("/editcomment", async (req,res) => {
  const {commentid, content} = req.body
  if (!commentid || !content) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})

  try {
    let [userid] = await db.query("select fk_UserDataId from Comments where CommentId = ?", [commentid])
    userid = userid[0].fk_UserDataId
    if (req.session.user.id !== userid) return res.status(403).json({success: false, error: "Not allowed to edit other people's comments"})

    try {
      await db.query("update Comments set Content = ? where fk_UserDataId = ? and CommentId = ?", [content, req.session.user.id, commentid])
    
      res.status(200).json({success: true, message: "Sucessfully edited the comment"})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error inserting the comment"})
    } 
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error inserting the comment"})
  }
})

app.delete("/deletecomment", async (req,res) => {
  const {commentid} = req.body
  if (!commentid) return res.status(400).json({success: false, error: "Missing data"})
})

//////////////////////////////////////////

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));