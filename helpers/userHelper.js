const User = require("../models/users"); // Adjust the path as necessary
const nodemailer = require("nodemailer");
const decryptData = require("./crypto");

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
listUpload = async (req, res) => {
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
submitForm = async (req, res) => {
  try {
    // Extract the encryptedData, idImage, and formToken from the request body
    const { encryptedData, formToken } = req.body;
    const idImage = req.file; // Assume the idImage file is sent via multipart form data

    // Validate input
    if (!encryptedData || !formToken || !idImage) {
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
    const { firstName, lastName, homeAddress, identification, dob } =
      decryptedData;

    // Ensure all required fields are present
    if (!firstName || !lastName || !homeAddress || !identification || !dob) {
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
    user.idImage = idImage.path; // Save the file path
    user.formFilled = true; // Toggle formFilled to true
    user.verified = true;
    await user.save();

    // Send success response
    res.status(201).json({ message: "Form submitted successfully", user });
  } catch (error) {
    console.error(error); // Log the error for debugging purposes
    res
      .status(500)
      .json({ message: "An error occurred.", error: error.message });
  }
};

getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0; // Default to page 0 if not provided
    const limit = 20; // Set a default limit of 20
    const assocCode = req.query.assocCode || null; // Get assocCode from the query, default to null

    // Calculate the number of items to skip based on the page
    const skip = page * limit;

    // Build the query object
    const query = assocCode ? { assocCode } : {}; // If assocCode is provided, filter by it

    // Fetch users based on the query with skip and limit for pagination
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

sendEmail = async (req, res) => {
  try {
    const { toEmail, subject, message } = req.body;
    const { id } = req.params; // Unique ID of the user

    // Validate input fields
    if (!toEmail || !subject || !message) {
      return res.status(400).json({
        status: false,
        message:
          "Please provide all required fields (toEmail, subject, message).",
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

    // Prepare the email content
    const msg = {
      from: '"Members verify" <Boi@membersverify.com>',
      to: toEmail,
      subject: subject,
      html: `
        <p>${message}</p>
        <br/>
        <a href='http://localhost:3030/onboarding-members/${user.formToken}' target='_blank'>
          Fill Out the Form
        </a>
      `, // Include user-specific form link
    };

    // Send email
    await transporter.sendMail(msg);

    // Update emailSent field in the database
    user.emailSent = true;
    await user.save();

    res.status(200).json({
      status: true,
      message: "Email sent successfully and status updated!",
    });
  } catch (error) {
    console.error("Error sending email:", error.message);

    res.status(500).json({
      status: false,
      message: "Failed to send email.",
      error: error.message,
    });
  }
};

getStats = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Users who have not submitted the form
    const notSubmittedForm = await User.countDocuments({ formFilled: false });

    // Users who have not received the email
    const emailNotSent = await User.countDocuments({ emailSent: false });

    // Current date
    const currentDate = new Date();

    // Users with upcoming expirations (termEnd > today)
    const upcomingExpirations = await User.countDocuments({
      termEnd: { $gt: currentDate },
    });

    // Users with expired terms (termEnd <= today)
    const expired = await User.countDocuments({
      termEnd: { $lte: currentDate },
    });

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

module.exports = {
  submitForm,
  getAllUsers,
  getUserById,
  deleteUserById,
  updateUserById,
  listUpload,
  sendEmail,
  getStats,
};
