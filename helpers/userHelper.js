const User = require("../models/users"); // Adjust the path as necessary
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const { uploadToS3 } = require("../routes/userRoutes");
const { decryptData } = require("./crypto");
const https = require("https");

const { v4: uuidv4 } = require("uuid"); // UUID library

// Helper function to fetch image from URL and convert to base64
const fetchImageAsBase64 = (imageUrl) => {
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(chunk);
      });
      response.on("end", () => {
        const imageBuffer = Buffer.concat(chunks);
        const imageBase64 = imageBuffer.toString("base64");
        resolve(imageBase64);
      });
      response.on("error", (error) => {
        reject("Error fetching image: " + error.message);
      });
    });
  });
};

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com", // Outlook's SMTP server
  port: 587, // TLS port
  secure: false, // Set to false because we're using STARTTLS
  auth: {
    user: "Boi@membersverify.com", // Your Outlook email address
    pass: process.env.EMAIL_KEY, // Your app password or regular password if MFA is disabled
  },
  tls: {
    rejectUnauthorized: false, // Optional: Disable certificate validation (useful for debugging)
  },
});
const listUpload = async (req, res) => {
  try {
    const data = req.body;
    const mappedData = data.map((entry) => ({
      assocCode: entry["Assoc Code"],
      association: entry["Association"],
      associationLiveDate: convertExcelDate(entry["Association Live Date"]),
      associationManager: entry["Association Manager"],
      boardMember: entry["Board Member"],
      memberRole: entry["Member Role"],
      memberType: entry["Member type"],
      termStart: convertExcelDate(entry["Term Start"]),
      termEnd: convertExcelDate(entry["Term End"]),
      firstName: entry["First Name"],
      lastName: entry["Last Name"],
      homeAddress: entry["Home Address"],
      homeCity: entry["Home City"],
      homeState: entry["Home State"],
      homeZip: entry["Home Zip"],
      mailingAddress: entry["Mailing Address"],
      mailingCity: entry["Mailing City"],
      mailingState: entry["Mailing State"],
      mailingZip: entry["Mailing Zip"],
      primaryEmail: entry["Primary Email"],
      primaryPhone: entry["Primary Phone"],
    }));

    console.log("Mapped data:", mappedData);

    const result = await User.insertMany(mappedData);
    console.log("Inserted documents:", result);
    res.status(200).json({
      message: `${mappedData.length} new entries added successfully.`,
      totalEntries: data.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing data" });
  }
};

// Helper function to convert Excel serial dates to JavaScript Dates
function convertExcelDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) {
    return null; // Handle invalid or missing date values
  }
  const startDate = new Date(1900, 0, 1); // Excel's epoch start date
  const convertedDate = new Date(
    startDate.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000
  );
  return isNaN(convertedDate.getTime()) ? null : convertedDate; // Return `null` for invalid dates
}

// Create a new user
const submitForm = async (req, res) => {
  try {
    const { encryptedData, formToken } = req.body;

    console.log(encryptedData, formToken);

    // Validate input
    if (!encryptedData || !formToken) {
      return res.status(400).json({
        message: "Encrypted data, form token, and idImage are required.",
      });
    }

    // Decrypt the encrypted data
    const secretKey = process.env.CRYPTO_SECRET_KEY;
    const decryptedData = decryptData(encryptedData, secretKey); // Decrypt the data
    console.log("decryptedData", decryptedData);

    // Ensure decryptedData is valid
    if (!decryptedData) {
      return res.status(400).json({ message: "Decryption failed." });
    }

    // Destructure decrypted data fields
    const { firstName, lastName, homeAddress, identification, dob, idImage } =
      decryptedData;

    // Ensure all required fields are present
    if (
      !firstName ||
      !lastName ||
      !homeAddress ||
      !identification ||
      !dob ||
      !idImage
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Find the user by formToken
    const user = await User.findOne({ formToken });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found or invalid form token." });
    }

    // Check if a user with the same identification already exists (excluding the current user)
    const existingUser = await User.findOne({ identification });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res
        .status(400)
        .json({ message: "User with this identification already exists." });
    }

    // Update the user's data and toggle formFilled to true
    user.firstName = firstName;
    user.lastName = lastName;
    user.homeAddress = homeAddress;
    user.identification = identification;
    user.dob = dob;
    user.idImage = idImage; // Save the file path
    user.formFilled = true; // Toggle formFilled to true
    user.verified = true;
    await user.save();

    // Send success response
    res.status(201).json({ message: "Form submitted successfully" });
  } catch (error) {
    console.error(error); // Log the error for debugging purposes
    res
      .status(500)
      .json({ message: "An error occurred.", error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 20;
    const filterName = req.query.filterName || null;
    const assocCode = req.query.assocCode || null;
    const expiringFilter = req.query.expiringFilter || null; // "expired", "expiring", or "no-term-end"
    const skip = page * limit;

    // Base query
    const query = assocCode ? { assocCode } : {};

    // Time calculations
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const nextWeek = new Date();
    const endOfNextWeek = new Date(nextWeek.setDate(nextWeek.getDate() + 7));
    endOfNextWeek.setHours(23, 59, 59, 999);

    // Apply expiringFilter logic
    if (expiringFilter === "expired") {
      query.termEnd = { $exists: true, $lt: startOfToday }; // Expired users
    } else if (expiringFilter === "expiring") {
      query.termEnd = { $exists: true, $gte: startOfToday, $lt: endOfNextWeek }; // Expiring users
    } else if (expiringFilter === "setDate") {
      query.termEnd = null; // No termEnd set
    }

    // Apply filterName logic
    if (filterName) {
      query.primaryEmail = { $regex: filterName, $options: "i" }; // Case-insensitive regex match
    }

    console.log("Query being sent:", query);

    // Fetch users with pagination and sorting
    const users = await User.find(query)
      .sort({ association: 1 }) // Sort by association in ascending order
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);

    // Return results
    res.json({
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: error.message });
  }
};

// Read a single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a user by ID
const updateUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "updated successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a user by ID
const deleteUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { toEmail, subject, message } = req.body;
    const { id } = req.params; // Unique ID of the user
    // Validate the email address
    if (!toEmail) {
      return res.status(400).json({
        status: false,
        message: "Recipient's email address (toEmail) is required.",
      });
    }

    const newFormToken = uuidv4();
    // Find the user by uniqueId
    const user = await User.findOneAndUpdate(
      { uniqueId: id },
      { formToken: newFormToken },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    // Determine the email content based on provided or default values
    const emailBody = {
      from: '"Members Verify" <boi@membersverify.com>',
      to: toEmail,
      subject: subject || "Members Verify - BOI Verification",
      html: message
        ? `<p>${message}</p>` // Custom message if provided
        : `
          <p>Hello,</p>
          <p>We hope this email finds you well. We're writing to inform you about the Corporate Transparency Act (CTA), a new federal law that will impact your HOA.</p>

          <h2>Understanding the Corporate Transparency Act (CTA)</h2>
          <p>The CTA is a new federal law requiring many Homeowners Associations (HOAs) to file Beneficial Ownership Information (BOI) with the Financial Crimes Enforcement Network (FinCEN). Failure to comply by January 1, 2025, could result in daily fines of $500.</p>

          <h3>Who Needs to Be Reported?</h3>
          <p>For HOAs, beneficial owners include:</p>
          <ul>
            <li>All board members</li>
            <li>Individuals owning more than 25% of the units in the association</li>
          </ul>

          <h3>What to Expect:</h3>
          <ol>
            <li>Receive this email from Members Verify</li>
            <li>Click the link below in this email</li>
            <li>Upload a photo ID (Driver's License or Passport)</li>
            <li>Certify the information is correct and submit</li>
            <li>Someone from Members Verify will finish the filing process and submit.</li>
          </ol>

          <p>If you have any questions or need to make any modifications, please email <a href="mailto:boi@membersverify.com">boi@membersverify.com</a>.</p>
          <br/>
          <a href='https://membersverify.com/onboarding-members/${user.formToken}' target='_blank' style="display:inline-block; padding:10px 20px; background-color:#007BFF; color:white; text-decoration:none; border-radius:5px;">
            Fill Out the Form
          </a>
          <br/>
          <br/>
          <br/>
          <br/>
        `,
    };

    // Send the email
    await transporter.sendMail(emailBody);

    // Update the user's emailSent status in the database
    user.emailSent = true;
    await user.save();

    // Respond with success
    res.status(200).json({
      status: true,
      message: "Email sent successfully, and user status updated!",
    });
  } catch (error) {
    console.error("Error sending email:", error.message);

    // Respond with error
    res.status(500).json({
      status: false,
      message: "Failed to send email.",
      error: error.message,
    });
  }
};

const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const notSubmittedForm = await User.countDocuments({ formFilled: false });
    const SubmittedForm = await User.countDocuments({ formFilled: true });
    const emailNotSent = await User.countDocuments({ emailSent: false });
    const currentDate = new Date();

    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(currentDate.getDate() + 1);

    const upcomingExpirationsUsers = await User.find(
      { termEnd: { $gt: currentDate, $lte: oneDayFromNow } },
      { termEnd: 1 }
    );

    const upcomingExpirations = upcomingExpirationsUsers.length;

    // Users with expired terms (termEnd <= today)
    const expiredUsers = await User.find(
      { termEnd: { $lte: currentDate } },
      { termEnd: 1 }
    );

    const expired = expiredUsers.length;

    // Construct the statistics response
    const stats = {
      totalUsers,
      notSubmittedForm,
      emailNotSent,
      SubmittedForm,
      upcomingExpirations,
      expired,
    };

    // Send the response
    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res
      .status(500)
      .json({ success: false, message: "An error occurred", error });
  }
};
const downloadExcel = async (req, res) => {
  try {
    // Fetch data from User model
    const users = await User.find().lean(); // Use lean() for plain JavaScript objects

    // Create a new workbook and a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("All Members");

    // Define columns for the worksheet
    worksheet.columns = [
      { header: "assocCode", key: "assocCode", width: 15 },
      { header: "association", key: "association", width: 50 },
      { header: "associationLiveDate", key: "associationLiveDate", width: 25 },
      { header: "associationManager", key: "associationManager", width: 25 },
      { header: "boardMember", key: "boardMember", width: 25 },
      { header: "memberRole", key: "memberRole", width: 25 },
      { header: "memberType", key: "memberType", width: 25 },
      { header: "termStart", key: "termStart", width: 25 },
      { header: "termEnd", key: "termEnd", width: 25 },
      { header: "firstName", key: "firstName", width: 20 },
      { header: "lastName", key: "lastName", width: 20 },
      { header: "homeAddress", key: "homeAddress", width: 30 },
      { header: "homeCity", key: "homeCity", width: 20 },
      { header: "homeState", key: "homeState", width: 10 },
      { header: "homeZip", key: "homeZip", width: 10 },
      { header: "mailingAddress", key: "mailingAddress", width: 30 },
      { header: "mailingCity", key: "mailingCity", width: 20 },
      { header: "mailingState", key: "mailingState", width: 10 },
      { header: "mailingZip", key: "mailingZip", width: 10 },
      { header: "primaryEmail", key: "primaryEmail", width: 30 },
      { header: "primaryPhone", key: "primaryPhone", width: 15 },
      { header: "identification", key: "identification", width: 30 },
      { header: "dob", key: "dob", width: 25 },
      { header: "idImage", key: "idImage", width: 50 },
    ];

    // Add rows to the worksheet
    for (const user of users) {
      const rowIndex = worksheet.lastRow ? worksheet.lastRow.number : 1; // Get the current row index
      worksheet.addRow(user); // Add user data to the worksheet
    }

    // Set the response headers for downloading an Excel file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="users.xlsx"');

    // Write to the response
    await workbook.xlsx.write(res);
    res.end(); // Ensure the response is ended properly
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  submitForm,
  getAllUsers,
  getUserById,
  deleteUserById,
  updateUserById,
  listUpload,
  sendEmail,
  getStats,
  downloadExcel,
};
