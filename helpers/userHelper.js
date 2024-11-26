const User = require("../models/users"); // Adjust the path as necessary
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { uploadToS3 } = require("../routes/userRoutes");
const { decryptData } = require("./crypto");
const https = require("https");
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
    const page = parseInt(req.query.page) || 0; // Default to page 0 if not provided
    const limit = 20; // Set a default limit of 20
    const assocCode = req.query.assocCode || null;
    const skip = page * limit;

    // Build the query object
    const query = assocCode ? { assocCode } : {};
    const users = await User.find(query).skip(skip).limit(limit);

    // Get the total number of users for pagination info
    const totalUsers = await User.countDocuments(query);

    // Return the paginated users along with total count
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

    // Find the user by uniqueId
    const user = await User.findOne({ uniqueId: id });
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
    // Fetch users from the database
    const users = await User.find();

    if (!users.length) {
      return res.status(404).send("No users found");
    }

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");

    // Define columns for the Excel sheet
    worksheet.columns = [
      { header: "Assoc Code", key: "assocCode", width: 15 },
      { header: "Association", key: "association", width: 20 },
      {
        header: "Association Live Date",
        key: "associationLiveDate",
        width: 20,
      },
      { header: "Association Manager", key: "associationManager", width: 20 },
      { header: "Board Member", key: "boardMember", width: 15 },
      { header: "Member Role", key: "memberRole", width: 15 },
      { header: "Member Type", key: "memberType", width: 15 },
      { header: "DOB", key: "dob", width: 12 },
      { header: "Term Start", key: "termStart", width: 15 },
      { header: "Term End", key: "termEnd", width: 15 },
      { header: "First Name", key: "firstName", width: 15 },
      { header: "Last Name", key: "lastName", width: 15 },
      { header: "Identification", key: "identification", width: 15 },
      { header: "Home Address", key: "homeAddress", width: 20 },
      { header: "ID Image", key: "idImage", width: 30 },
    ];

    // Add rows for each user
    for (const user of users) {
      const row = worksheet.addRow({
        assocCode: user.assocCode,
        association: user.association,
        associationLiveDate: user.associationLiveDate
          ? user.associationLiveDate.toISOString().split("T")[0]
          : "",
        associationManager: user.associationManager,
        boardMember: user.boardMember,
        memberRole: user.memberRole,
        memberType: user.memberType,
        dob: user.dob ? user.dob.toISOString().split("T")[0] : "",
        termStart: user.termStart
          ? user.termStart.toISOString().split("T")[0]
          : "",
        termEnd: user.termEnd ? user.termEnd.toISOString().split("T")[0] : "",
        firstName: user.firstName,
        lastName: user.lastName,
        identification: user.identification,
        homeAddress: user.homeAddress,
        idImage: "", // Placeholder for image (not embedding in this case)
      });

      // If an image exists (URL from S3), fetch it and embed in the Excel
      if (user?.idImage) {
        try {
          const imageBase64 = await fetchImageAsBase64(user.idImage);

          if (imageBase64) {
            // Dynamically detect image extension (png, jpg, jpeg)
            const ext = user.idImage.split(".").pop(); // Get the file extension
            const imageId = workbook.addImage({
              base64: imageBase64,
              extension: ext, // Use the correct extension
            });

            worksheet.addImage(imageId, {
              tl: { col: 13, row: row.number - 1 }, // Position (13th column, same row)
              ext: { width: 100, height: 100 }, // Image size
            });
          }
        } catch (error) {
          console.error("Error fetching image from S3:", error);
        }
      }
    }

    // Write the Excel file to a buffer
    const buffer = await workbook.xlsx.writeBuffer();
    console.log("Buffer created:", buffer.length); // Debugging the buffer size
    fs.writeFileSync("test.xlsx", buffer);
    // Set the response headers and send the file
    res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Cache-Control", "no-store");

    // Ensure to use res.send() for sending the buffer
    res.send(buffer); // This will download the file to the browser
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).send("Error generating Excel file");
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
