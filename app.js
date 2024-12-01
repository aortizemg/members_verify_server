/* eslint-disable consistent-return */
require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const connectDB = require("./db");
const Admin = require("./models/admins"); // Admin model
const userRoutes = require("./routes/userRoutes"); // Adjust the path as necessary
const adminRoutes = require("./routes/adminRoutes"); // Adjust the path as necessary
const app = express();
const port = process.env.PORT || 3000;

app.use("/uploads", express.static("uploads"));

app.set("trust proxy", 1);
app.use(
  cors({
    credentials: true,
    origin: [
      "http://localhost:3030",
      "http://localhost:3031",
      "http://localhost:60524",
      "https://membersverify.com/",
      "https://membersverify.com",
      "https://orca-app-mv9st.ondigitalocean.app",
      "https://orca-app-mv9st.ondigitalocean.app/",
    ],
  })
);
connectDB();
app.use(express.json({ limit: "20mb" }));
app.use(
  express.urlencoded({ limit: "20mb", extended: true, parameterLimit: 20000 })
);

const JWT_SECRET = process.env.JWT_SECRET || "mySuperSecretKey123";

// Generate JWT token
const generateToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

// Admin login route
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log("Login request received:", { username, password });

    // Fetch admin user from the database
    const admin = await Admin.findOne({ username });
    console.log("Admin fetched from database:", admin);

    if (!admin) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid username or password" });
    }

    // Directly compare the passwords (no hashing)
    if (admin.password !== password) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid username or password" });
    }

    // Generate JWT token
    const token = generateToken(admin);
    console.log("Generated token:", token);

    res.status(200).json({ status: true, token, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res
      .status(403)
      .json({ message: "Access forbidden: No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({ message: "Access forbidden: Invalid token" });
    req.user = user;
    next();
  });
};

app.post("/create", async (req, res) => {
  try {
    const username = "admin";
    const password = "d4E/Nc^6T5?8";
    const email = "adesign128@gmail.com";

    // Check if the username or email already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    if (existingAdmin) {
      return res.status(400).json({
        status: false,
        message: "Username already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the new admin
    const newAdmin = new Admin({
      username,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    res.status(201).json({
      status: true,
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
});

// Admin dashboard route
app.get("/admin/dashboard", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access forbidden: Admins only" });
  }

  res.json({
    message: "Welcome to the Admin Dashboard",
    user: req.user,
  });
});

// Example third-party API integration
app.post("/api/webhook", (req, res) => {
  const { result } = req.body;
  console.log("result", result);

  res.json({
    message: "Third-party API integration will go here!",
    result: req.body.result,
  });
});

// Use user and admin routes
app.use("/api/user", userRoutes);
app.use("/api/admin", verifyToken, adminRoutes);

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
