const { db } = require("../db.js")
const bcrypt = require("bcrypt")

async function isloggedin(req, res) {
  if (req.session.user) {
    res.status(200).json({success: true, loggedin: true, message: "Logged in"})
  } else {
    res.status(200).json({success: true, loggedin: false, message: "Not logged in"})
  }
}

async function userdata(req, res) {
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})
  
    try {
      let [user] = await db.query("select * from UserData where UserDataId = ?", [req.session.user.id])
      user = user[0]
  
      res.status(200).json({id: user.UserDataId, username: user.Username, email: user.Email, role: user.UserRole, selectedlanguage: user.SelectedLanguage})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error retrieving data from the database"})
    }
}

async function getallusers(req, res) {
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
    user = user[0]
    if (user.UserRole !== "admin" ) return res.status(403).json({success: false, error: "Forbidden"})
    
    try {
      const [users] = await db.query("select UserDataId, Username, UserRole from UserData")

      res.status(200).json({success: true, users: users})
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while fetching users"})
    }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while trying to check userrole"})
  }
}

async function register(req, res) {
  const {username, email, password, selectedlanguage} = req.body
  if (!username || !email || !password || !selectedlanguage) return res.status(400).json({success: false, error: "Missing data"})   
    try {
      const [dbusername] = await db.query("select * from UserData where Username = ?", [username])
      const [dbemail] = await db.query("select * from UserData where Email = ?", [email])
  
      if (dbusername.length !== 0) return res.status(400).json({success: false, error: "Username is taken"})
      if (dbemail.length !== 0) return res.status(400).json({success: false, error: "E-Mail is taken"})
  
      try {
        const hashedpassword = await bcrypt.hash(password, 10)
        const [result] = await db.query("insert into UserData (Username, Email, UserPassword, SelectedLanguage) values (?,?,?,?)", [username, email, hashedpassword, selectedlanguage])
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
}

async function login(req, res) {
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
}

async function logout(req, res) {
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    req.session.destroy()
    res.clearCookie('SessionId')
    res.status(200).json({success: true, message: 'Logged out successfully'})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while logging out"})
  }
}

async function rolemod(req, res) {
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
}

async function roleadmin(req, res) {
  const {userdataid} = req.body
    if (!userdataid) return res.status(400).json({success: false, message: "Missing data"})
    if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})
   
    try {
      let [user] = await db.query("select UserRole from UserData where UserDataId = ?", [req.session.user.id])
      user = user[0]
      let [updatinguser] = await db.query("select Username from UserData where UserDataId = ?", [userdataid])
      if (user.length === 0) return res.status(404).json({success: false, error: "User not found"})
      updatinguser = updatinguser[0]
      
      if (user.UserRole !== "admin") return res.status(403).json({success: false, error: "Forbidden"})
  
      try {
        await db.query("update UserData set UserRole = 'admin' where UserDataId = ?", [userdataid])
        res.status(200).json({success: true, message: `Successfully made '${updatinguser.Username}' an admin`})
      } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while updating the database"})
      }
    } catch (error) {
      res.status(500).json({success: false, error: "Error while checking the users role"})
    }
}

async function roleuser(req, res) {
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
            res.status(200).json({success: true, message: `Successfully made '${updatinguser.Username}' a user`})
        } catch (error) {
            console.error("Error:", error)
            res.status(500).json({success: false, error: "Error while updating the database"})
        }
        
    } catch (error) {
        res.status(500).json({success: false, error: "Error while checking the users role"})
    }
}

async function edituser(req, res) {
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
}

async function deleteuser(req, res) {
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
            await db.query("delete from sessions where data like ?", [`%"id":${userdataid}%`]);
            res.status(200).json({success: true, message: `Successfully deleted '${deletinguser.Username}'`})
        } catch (error) {
            console.error("Error:", error)
            res.status(500).json({success: false, error: "Error while deleting the user from the database"})
        }
    } catch (error) {
      console.error("Error:", error)
      res.status(500).json({success: false, error: "Error while checking the users role"})
    }
}

async function changeselectedlanguage(req, res) {
  const {languagecode} = req.body
  if (!languagecode) return res.status(400).json({success: false, message: "Missing data"})
  if (!req.session.user) return res.status(401).json({success: false, message: 'Unauthorized'})

  try {
    await db.query("update UserData set SelectedLanguage = ? where UserDataId = ?", [languagecode, req.session.user.id])
    res.status(200).json({success: true, message: "Successfully changed Language to " + languagecode})
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({success: false, error: "Error while updating selected language"})
  }
}

module.exports = {
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
}