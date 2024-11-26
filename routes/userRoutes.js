const express = require("express");
const multer = require("multer");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { submitForm } = require("../helpers/userHelper");
const { encryptData } = require("../helpers/crypto");
const fs = require("fs");

const router = express.Router();

// AWS S3 Client Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_SECRET_ACCESS_KEY,
  },
});

// Multer Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const isFileTypeAllowed =
      allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
      allowedTypes.test(file.mimetype);
    if (isFileTypeAllowed) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images and PDFs are allowed."));
    }
  },
});

// Upload to S3 Function
const uploadToS3 = async (file) => {
  const fileName = `uploads/${Date.now()}-${file.originalname}`;
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME, // Your S3 bucket name
    Key: fileName, // File path in the bucket
    Body: file.buffer, // File content
    ContentType: file.mimetype, // MIME type
    ACL: "public-read", // Optional: Makes the file publicly readable
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  // Return the S3 file URL
  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

// API Route

router.post("/upload-id", upload.single("idImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "File is required!" });
    }
    const secretKey = process.env.CRYPTO_SECRET_KEY;
    const fileUrl = await uploadToS3(req.file);
    const encryptedFileUrl = encryptData(fileUrl, secretKey);
    res.status(200).send({
      message: "File uploaded successfully!",
      encryptedFileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: "An error occurred during file upload.",
      error: error.message,
    });
  }
});

router.post("/submit-form", submitForm);
router.post("/download", (req, res) => {
  const filePath = path.join(__dirname, "..", "test.xlsx");

  // Set headers manually (although res.download usually sets them for you)
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

  res.download(filePath, "users.xlsx", (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

module.exports = router;
