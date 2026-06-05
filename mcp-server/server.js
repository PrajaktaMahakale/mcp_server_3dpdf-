// ======================================================
// server.js
// Entry point — wires Express app with all route modules
// ======================================================

import express from "express";
import cors from "cors";

import { addWellKnownRoutes } from "./routes/well-known-routes.js";
import { addOAuthRoutes } from "./routes/oauth-routes.js";
import { addMcpRoutes } from "./routes/mcp-routes.js";

// ======================================================
// EXPRESS APP
// ======================================================

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "Mcp-Session-Id"],
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
    credentials: true,
  })
);
console.log("✓ before cors");

app.options(/.*/, cors());
console.log("✓ express.json()");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// CONFIG
// ======================================================

const BASE_URL = " https://4955-122-174-66-65.ngrok-free.app";
console.log("✓ Base URL initialized:", BASE_URL);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function getBaseUrl(req) {
  console.log("Using BASE_URL from environment:", BASE_URL);
  return BASE_URL;
}

// In-memory auth code store (single-use, lost on restart)
const authCodes = new Map();

// ======================================================
// REGISTER ROUTES
// ======================================================
console.log("✓ Well-known routes adding");
addWellKnownRoutes(app, getBaseUrl);
console.log("✓ Well-known routes added");


addOAuthRoutes(app, authCodes, getBaseUrl, FRONTEND_URL);
console.log("✓ OAuth routes added");

addMcpRoutes(app, getBaseUrl);
console.log("✓ MCP routes added");

// ======================================================
// PROCESS ERROR HANDLERS
// ======================================================

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION");
  console.error("Reason:", reason);
  if (reason instanceof Error) {
    console.error("Stack:", reason.stack);
  }
});

// ======================================================
// START SERVER
// ======================================================

console.log("Starting server initialization...");

const serverInstance = app.listen(3000, () => {
  console.log("MCP Server Running on port 3000");
  console.log(`Base URL: ${BASE_URL}`);
});

serverInstance.on("error", (err) => {
  console.error("Server error:", err);
});
