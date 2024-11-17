const express = require("express");
const { submitForm } = require("../helpers/userHelper");

// Import necessary modules
const multer = require("multer");
const path = require("path");

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Directory where files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

// Set up file filter to allow only images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const isFileTypeAllowed =
    allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
    allowedTypes.test(file.mimetype);
  cb(null, isFileTypeAllowed);
};

// Initialize multer with storage and file filter
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit of 10 MB
  fileFilter,
});

const router = express.Router();

// CRUD Routes
router.post("/submit-form", upload.single("idImage"), submitForm); // Create a new user

module.exports = router;
