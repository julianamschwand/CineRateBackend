const { db } = require("../db.js")

async function addmovie(req, res) {
  const {title, description, playbackid, duration, releaseyear} = req.body
  const poster = req.file.filename
  if (!title || !description || !poster || !playbackid || !duration || !releaseyear) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})
  
  const titleJSON = JSON.parse(title)
  const descriptionJSON = JSON.parse(description)

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]

    if (user.UserRole !== "admin" && user.UserRole !== "mod") return res.status(403).json({success: false, error: "Forbidden"})

    try {
      let [languagecodes] = await db.query("select LanguageCode from Languages")
      languagecodes = languagecodes.map(lang => lang.LanguageCode)
      try {
        const posterPath = "/posters/" + poster

        const [result] = await db.query("insert into Movies (PlaybackId, Poster, Duration, ReleaseYear) values (?,?,?,?)", [playbackid, posterPath, duration, releaseyear])
        const movieid = result.insertId

        try {
          for (const lang of languagecodes) {
            if (titleJSON.hasOwnProperty(lang) && descriptionJSON.hasOwnProperty(lang)) {
              let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [lang])
              languageid = languageid[0].LanguageId

              await db.query("insert into MovieTranslations (Title, MovieDescription, fk_LanguageId, fk_MovieId) values (?,?,?,?)", [titleJSON[lang], descriptionJSON[lang], languageid, movieid])
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
}

async function getmovies(req, res) {
  const {languagecode} = req.query
  if (!languagecode) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [languagecode])
    languageid = languageid[0].LanguageId
    try {
      let [movies] = await db.query("select MovieId, coalesce(Title, (select Title from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Title', coalesce(MovieDescription, (select MovieDescription from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Description', PlaybackId, Poster, Duration, ReleaseYear from Movies left join MovieTranslations on MovieId = fk_MovieId and fk_LanguageId = ?", [languageid])
      res.status(200).json({success: true, movies: movies})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching movies"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while fetching the language id"})
  }
}

async function getmoviedata(req, res) {
  const {movieid, languagecode} = req.query
  if (!movieid || !languagecode) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [movie] = await db.query("select * from Movies where MovieId = ?", [movieid])
    if (movie.length === 0) return res.status(404).json({success: false, error: "Movie not found"})

    try {
      let [languageid] = await db.query("select LanguageId from Languages where LanguageCode = ?", [languagecode])
      languageid = languageid[0].LanguageId

      try {
        let [movie] = await db.query("select MovieId, coalesce(Title, (select Title from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Title', coalesce(MovieDescription, (select MovieDescription from MovieTranslations where fk_MovieId = MovieId and fk_LanguageId = 1), 'none') as 'Description', PlaybackId, Poster, Duration, ReleaseYear from Movies left join MovieTranslations on MovieId = fk_MovieId and fk_LanguageId = ? where MovieId = ?", [languageid, movieid])
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
}

async function getallmoviedata(req, res) {
    const {movieid} = req.query
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
        
                const moviequery = `select MovieId, json_object(${titlelanguages}) as Title, json_object(${descriptionlanguages}) as Description, PlaybackId, Poster, Duration, ReleaseYear from Movies join MovieTranslations on MovieId = fk_MovieId where MovieId = ?`
      
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
}

async function editmovie(req, res) {
    const {movieid, title, description, playbackid, poster, duration, releaseyear} = req.body
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
            if (duration) {
                await db.query("update Movies set Duration = ? where MovieId = ?", [duration, movieid])
            }
            if (releaseyear) {
                await db.query("update Movies set ReleaseYear = ? where MovieId = ?", [releaseyear, movieid])
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
}

async function deletemovie(req, res) {
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

}

module.exports = {
  addmovie,
  getmovies,
  getmoviedata,
  getallmoviedata,
  editmovie,
  deletemovie,
};