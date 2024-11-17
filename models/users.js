const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // UUID library for generating unique IDs

const userSchema = new mongoose.Schema(
  {
    assocCode: {
      type: String,
      trim: true,
    },
    association: {
      type: String,
      trim: true,
    },
    associationLiveDate: {
      type: Date,
    },
    associationManager: {
      type: String,
      trim: true,
    },
    boardMember: {
      type: String,
      trim: true,
    },
    memberRole: {
      type: String,
      trim: true,
    },
    memberType: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
    },
    termStart: {
      type: Date,
    },
    termEnd: {
      type: Date,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    identification: {
      type: String,
      trim: true,
    },
    homeAddress: {
      type: String,
      trim: true,
    },
    homeAddress2: {
      type: String,
      trim: true,
    },
    homeCity: {
      type: String,
      trim: true,
    },
    homeState: {
      type: String,
      trim: true,
    },
    homeZip: {
      type: String,
      trim: true,
    },
    mailingAddress: {
      type: String,
      trim: true,
    },
    mailingAddress2: {
      type: String,
      trim: true,
    },
    mailingCity: {
      type: String,
      trim: true,
    },
    mailingState: {
      type: String,
      trim: true,
    },
    mailingZip: {
      type: String,
      trim: true,
    },
    primaryEmail: {
      type: String,
      trim: true,
      unique: true, // Ensures each email is unique
      sparse: true, // Allows multiple `null` values
    },
    primaryPhone: {
      type: String,
      trim: true,
    },
    idImage: {
      type: String,
    },
    uniqueId: {
      type: String,
      unique: true, // Makes this field unique
      default: uuidv4, // Automatically generates a unique ID for each document
    },
    verified: {
      type: Boolean,
      default: false, // Default is false, meaning the member is not verified
    },
    emailSent: {
      type: Boolean,
      default: false, // Tracks if the email has been sent
    },
    formFilled: {
      type: Boolean,
      default: false, // Tracks if the user has filled the form
    },
    formToken: {
      type: String,
      unique: true, // Unique token for form submission tracking
      default: uuidv4, // Generate a unique token for each user
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
