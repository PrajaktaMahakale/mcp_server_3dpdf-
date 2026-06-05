import dotenv from "dotenv";
dotenv.config();

const configurl = {
  apiBaseUrl: process.env.API_BASE_URL,
};

console.log("[env] API_BASE_URL:", configurl.apiBaseUrl);

export default configurl;
