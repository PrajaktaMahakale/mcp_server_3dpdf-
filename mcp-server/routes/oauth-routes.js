import crypto from "crypto";
import { verifyToken } from "../auth/middleware.js";

async function handleAuthRedirect(req, res, FRONTEND_URL) {
  const { client_id, redirect_uri, state, scope } = req.query;
  const frontendUrl = new URL(FRONTEND_URL);

  if (client_id) frontendUrl.searchParams.set("client_id", client_id);
  if (redirect_uri) frontendUrl.searchParams.set("redirect_uri", redirect_uri);
  if (state) frontendUrl.searchParams.set("state", state);
  if (scope) frontendUrl.searchParams.set("scope", scope);

  res.redirect(frontendUrl.toString());
}
 console.log("==================================== before addOAuthRoutes");
function addOAuthRoutes(app, authCodes, getBaseUrl, FRONTEND_URL) {
  app.get("/auth", (req, res) => handleAuthRedirect(req, res, FRONTEND_URL));

  app.post("/oauth/firebase-login", async (req, res) => {
    console.log("====================================");
    console.log("POST /oauth/firebase-login HIT");
    console.log("Body:", req.body);
    try {
      const { token, client_id, redirect_uri, state, scope } = req.body;
      const firebaseUser = await verifyToken(token);
      console.log("Verified Firebase User:", firebaseUser.email);

      const code = crypto.randomBytes(32).toString("hex");

      authCodes.set(code, {
        client_id,
        redirect_uri,
        scope,
        user: firebaseUser,
        firebaseToken: token,
      });

      let redirect = `${redirect_uri}?code=${code}`;
      if (state) redirect += `&state=${state}`;

      console.log("Generated Auth Code, redirecting to:", redirect);
      res.json({ redirect });
    } catch (err) {
      console.error("firebase-login Exchange Error:", err.message);
      res.status(401).json({ error: err.message });
    }
  });

  app.post("/token", async (req, res) => {
    console.log("====================================");
    console.log("POST /token HIT");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    try {
      const { code, client_id } = req.body;
      const authData = authCodes.get(code);
      console.log("authData:", authData);

      if (!authData) {
        console.error("Token Error: Invalid or missing authorization code:", code);
        return res.status(400).json({ error: "Invalid authorization code" });
      }

      authCodes.delete(code);

      // Return the Firebase ID token directly — backend verifies Firebase tokens
      const firebaseToken = authData.firebaseToken;

      console.log("Firebase token returned successfully for user:", authData.user.email);
      res.json({ access_token: firebaseToken, token_type: "Bearer", expires_in: 3600 });
    } catch (err) {
      console.error("Token exchange failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

export { addOAuthRoutes };
