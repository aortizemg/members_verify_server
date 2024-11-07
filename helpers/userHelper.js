const User = require("../models/users"); // Adjust the path as necessary

// Create a new user
const createUser = async (req, res) => {
  try {
    // Form data fields are now in req.body, and the file is in req.file
    const { fullname, address, identification, dob } = req.body;
    console.log(req.body);

    if (!fullname || !address || !identification || !dob) {
      return res.status(400).json({ message: "All fields are required." });
    } // Check if a user with the same identification already exists
    const existingUser = await User.findOne({ identification });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this identification already exists." });
    }

    const user = new User({
      fullname,
      address,
      identification,
      dob,
      idImage: req.file.path, // Save the file path
    });

    await user.save();
    res.status(201).json({ message: "Data successfully uploaded", user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Read all users
getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Read a single user by ID
getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a user by ID
updateUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a user by ID
deleteUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  deleteUserById,
  updateUserById,
};
