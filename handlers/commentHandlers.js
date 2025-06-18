const { db } = require("../db.js")

async function getcomments(req, res) {
    const {movieid} = req.query
  if (!movieid) return res.status(400).json({success: false, error: "Missing data"})

  try {
    const [comments] = await db.query("select CommentId, Content, (select Username from UserData where UserDataId = fk_UserDataId) as 'Username', fk_UserDataId as 'CommentUserId' from Comments where fk_MovieId = ?", [movieid]) 
    
    res.status(200).json({success: true, comments: comments})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error fetching comments"})
  }
}

async function addcomment(req, res) {
    const {movieid, content} = req.body
      if (!movieid || !content) return res.status(400).json({success: false, error: "Missing data"})
      if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})
    
      try {
        await db.query("insert into Comments (Content, fk_UserDataId, fk_MovieId) values (?,?,?)", [content, req.session.user.id, movieid])
        
        res.status(200).json({success: true, message: "Sucessfully commented on the movie"})
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while inserting the comment"})
      }
}

async function editcomment(req, res) {
    const {commentid, content} = req.body
      if (!commentid || !content) return res.status(400).json({success: false, error: "Missing data"})
      if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})
    
      try {
        let [commentuserid] = await db.query("select fk_UserDataId from Comments where CommentId = ?", [commentid])
        commentuserid = commentuserid[0].fk_UserDataId
        if (req.session.user.id !== commentuserid) return res.status(403).json({success: false, error: "Not allowed to edit other people's comments"})
    
        try {
          await db.query("update Comments set Content = ? where fk_UserDataId = ? and CommentId = ?", [content, req.session.user.id, commentid])
        
          res.status(200).json({success: true, message: "Sucessfully edited the comment"})
        } catch (error) {
          console.error("Error:", error)
          res.status(500).json({success: false, error: "Error while updating the comment"})
        } 
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while checking the comment's user"})
      }
}

async function deletecomment(req, res) {
    const {commentid} = req.body
  if (!commentid) return res.status(400).json({success: false, error: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, error: "Unauthorized"})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    let [commentuser] = await db.query("select fk_UserDataId from Comments where CommentId = ?", [commentid])
    commentuser = commentuser[0]

    if (user.UserRole !== "admin" && user.UserRole !== "mod" && commentuser.fk_UserDataId !== req.session.user.id) return res.status(403).json({success: false, error: "Forbidden"})
    
    try {
      await db.query("delete from Comments where CommentId = ?", [commentid])

      res.status(200).json({success: true, message: "Sucessfully deleted the comment"})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while deleting the comment"})
    }
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while checking for permission"})
  }
}

module.exports = {
  getcomments,
  addcomment,
  editcomment,
  deletecomment,
};