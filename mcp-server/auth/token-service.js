import { verifyToken } from "./middleware.js";

async function authenticateUser(token) {
  if (!token) {
    throw new Error("No token provided");
  }
  return await verifyToken(token);
}

export { authenticateUser };
