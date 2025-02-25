const axios = require("axios");
const qs = require("qs");

let accessToken = null;
let tokenExpiresAt = 0; // Store expiration timestamp

const fetchAccessToken = async () => {
  try {
    const clientId = process.env.CLIENT_ID;
    const secret = process.env.CLIENT_SECRET;
    const scope = process.env.SCOPE;
    console.log("clientId", clientId, scope, secret);
    if (!clientId || !scope) {
      throw new Error("Missing required environment variables");
    }

    // Encode clientId and clientSecret to Base64 ("clientId:clientSecret")
    const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
    console.log("credentials", credentials);

    const headers = {
      Authorization: `Basic ${credentials}`, // Correctly formatted Auth header
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const data = qs.stringify({
      grant_type: "client_credentials",
      scope: scope, // Scope should match "BOSS-EFILE-SANDBOX" or "BOSS-EFILE"
    });

    const response = await axios.post(
      "https://iam.fincen.gov/am/oauth2/realms/root/realms/Finance/access_token",
      data,
      { headers }
    );

    // Store new access token and expiration time
    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000; // Convert to milliseconds

    console.log("New access token obtained:", accessToken);
    return accessToken;
  } catch (error) {
    console.error(
      "Error fetching access token:",
      error.response?.data || error.message
    );
    throw new Error("Failed to retrieve access token");
  }
};

const ensureValidToken = async (req, res, next) => {
  try {
    // Refresh token 1 minute before expiry (60,000 ms)
    if (!accessToken || Date.now() >= tokenExpiresAt - 60000) {
      await fetchAccessToken();
    }
    console.log("accessToken", accessToken);

    req.accessToken = accessToken;
    next();
  } catch (error) {
    console.error("Error ensuring valid token:", error.message);
    return res
      .status(500)
      .json({ error: "Unable to refresh access token", error });
  }
};

module.exports = {
  ensureValidToken,
  fetchAccessToken,
};
