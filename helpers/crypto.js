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

const encryptData = (data, secretKey) => {
  try {
    // Encrypt the data (image URL in this case)
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      secretKey
    ).toString();
    return encryptedData;
  } catch (error) {
    throw new Error("Failed to encrypt data.");
  }
};

module.exports = { decryptData, encryptData };
