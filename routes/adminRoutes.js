const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  listUpload,
  sendEmail,
  getStats,
} = require("../helpers/userHelper");
const { getAssocList } = require("../controller/adminController");

const router = express.Router();
// CRUD Routes
router.get("/getStats", getStats); // Read all users
router.get("/getAssoc", getAssocList); // Read all users
router.get("/getAllUsers/:page?/:assocCode?", getAllUsers); // Read all users
router.get("/getUserById/:id", getUserById); // Read a single user by ID
router.put("/updateUser/:id", updateUserById); // Update a user by ID
router.delete("/deleteUser/:id", deleteUserById); // Delete a user by ID
router.post("/list-upload", listUpload); // Delete a user by ID
router.post("/send-email/:id", sendEmail); // Delete a user by ID

module.exports = router;
