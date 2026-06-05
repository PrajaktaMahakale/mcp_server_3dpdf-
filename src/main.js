import { signInWithGoogle } from "./auth/google-signin.js";
import { getOAuthParamsFromUrl, exchangeFirebaseToken } from "./auth/oauth-exchange.js";

const button = document.getElementById("googleLogin");

button.addEventListener("click", async () => {
  try {
    const token = await signInWithGoogle();
    const params = getOAuthParamsFromUrl();

    console.log("Firebase Token:", token);

    if (params.redirect_uri) {
      console.log("OAuth flow detected from ChatGPT. Redirecting...");
      const data = await exchangeFirebaseToken(token, params);

      if (data.redirect) {
        console.log("Redirecting back to ChatGPT callback...");
        window.location.href = data.redirect;
        return;
      }

      throw new Error("Failed to retrieve redirect URL from backend");
    }

    console.log("Standard login successful!");
    alert(`Login successful!\nFirebase Token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error(error);
    alert("Login or connection failed: " + error.message);
  }
});