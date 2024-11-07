const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} = require("../helpers/userHelper");

const router = express.Router();
// CRUD Routes
router.get("/getAllUsers", getAllUsers); // Read all users
router.get("/getUserById/:id", getUserById); // Read a single user by ID
router.put("/updateUser/:id", updateUserById); // Update a user by ID
router.delete("/deleteUser/:id", deleteUserById); // Delete a user by ID

module.exports = router;
