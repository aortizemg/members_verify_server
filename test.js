const bcrypt = require("bcrypt");

// Hash a password
async function hashPassword(plainPassword) {
  const saltRounds = 10; // The cost factor for hashing
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    console.log("Hashed Password:", hashedPassword);
    return hashedPassword;
  } catch (err) {
    console.error("Error hashing password:", err);
  }
}

// Example usage
hashPassword("mySecurePassword123");
