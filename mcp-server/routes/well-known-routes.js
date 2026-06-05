function addWellKnownRoutes(app, getBaseUrl) {
  const resourceResponse = (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "profile", "email"],
    });
  };

  app.get("/.well-known/oauth-protected-resource", resourceResponse);
  app.get("/mcp/.well-known/oauth-protected-resource", resourceResponse);

  const openidConfigResponse = (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/auth`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["openid", "profile", "email"],
      subject_types_supported: ["public"],
    });
  };

  app.get("/.well-known/openid-configuration", openidConfigResponse);
  app.get("/mcp/.well-known/openid-configuration", openidConfigResponse);

  const oauthServerResponse = (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/auth`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
    });
  };

  app.get("/.well-known/oauth-authorization-server", oauthServerResponse);
  app.get("/mcp/.well-known/oauth-authorization-server", oauthServerResponse);
}

export { addWellKnownRoutes };
