const { db } = require("../db.js")

async function getrating(req, res) {
    const {movieid} = req.query
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})

  try {
    let [rating] = await db.query("select round(avg(RatingValue), 2) as 'Rating' from Ratings where fk_MovieId = ? group by RatingValue", [movieid])
    if (rating.length === 0) return res.status(404).json({success: false, rating: "No rating"})
    rating = rating[0].Rating

    res.status(200).json({success: true, rating: rating})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error fetching rating"})
  }
}


async function rate(req, res) {
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
          res.status(500).json({success: false, error: "Error while inserting / updating the rating"})
        }
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while fetching ratings"})
      }
}

module.exports = {
  getrating,
  rate,
};