const { db } = require("../db.js")

async function getlanguages(req, res) {
    try {
        const [languages] = await db.query("select * from Languages")
        res.status(200).json({success: true, languages: languages})
    } catch (error) {
        console.error("Error:", error)
        res.status(500).json({success: false, error: "Error while fetching languages from the database"})
    }
}

module.exports = {
  getlanguages,
};