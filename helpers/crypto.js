const CryptoJS = require("crypto-js");

const decryptData = (encryptedData, secretKey) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
  } catch (error) {
    throw new Error("Failed to decrypt data. Invalid format or key.");
  }
};

module.exports = decryptData;
