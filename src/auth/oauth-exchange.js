const BACKEND_URL = "http://localhost:3000";

export function getOAuthParamsFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    client_id: urlParams.get("client_id"),
    redirect_uri: urlParams.get("redirect_uri"),
    state: urlParams.get("state"),
    scope: urlParams.get("scope"),
  };
}

export async function exchangeFirebaseToken(token, { client_id, redirect_uri, state, scope }) {
  const response = await fetch(`${BACKEND_URL}/oauth/firebase-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      client_id,
      redirect_uri,
      state,
      scope,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || "Failed to exchange Firebase token");
  }

  return await response.json();
}
