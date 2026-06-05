import express from "express";
import { AsyncLocalStorage } from "async_hooks";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticateUser } from "../auth/token-service.js";
import { createMcpServer } from "../mcp/server-factory.js";
import { uploadContext } from "../mcp/tools/upload-store.js";

const authStorage = new AsyncLocalStorage();

function addMcpRoutes(app, getBaseUrl) {
  // ======================================================
  // GET /mcp — SSE / tool discovery for ChatGPT
  // ======================================================


  // ======================================================
  // DYNAMIC CLIENT REGISTRATION
  // ======================================================

  app.post("/register", (req, res) => {
    console.log("Dynamic Client Registration");
    console.log(req.body);

    res.status(201).json({
      client_id: "chatgpt-client",
      redirect_uris: req.body.redirect_uris || [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  });

  console.log("✓ /register route added");

  // ======================================================
  // POST /mcp — tool invocation
  // ======================================================

  app.post("/mcp", express.raw({ type: "*/*", limit: "100mb" }), async (req, res) => {
    const traceId = `REQ-${Date.now()}`;
    console.log("====================================");
    console.log(`[${traceId}] POST /mcp HIT`);
    console.log(`[${traceId}] Time:`, new Date().toISOString());

    try {
      console.log(`[${traceId}] Content-Type:`, req.headers["content-type"]);
      console.log(`[${traceId}] Content-Length:`, req.headers["content-length"]);
      console.log(`[${traceId}] Has Authorization:`, !!req.headers.authorization);

      const authHeader = req.headers.authorization;

      // =========================================
      // AUTH CHECK
      // =========================================

      if (!authHeader) {
        console.log(`[${traceId}] ❌ No Authorization header — returning 401`);

        const baseUrl = getBaseUrl(req);

        res.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${baseUrl}/mcp/.well-known/oauth-protected-resource"`
        );

        return res.status(401).json({
          error: "Unauthorized",
        });
      }
      console.log(`[${traceId}] ✓ Authorization header present`);

      const token = authHeader.split(" ")[1];
      console.log(`[${traceId}] Token extracted (length: ${token?.length})`);

      // Store firebase token so MCP tools (upload_zip_file, convert_iam_file) can use it
      uploadContext.firebaseToken = token;

      // =========================================
      // VERIFY TOKEN
      // =========================================

      let user;

      try {
        console.log(`[${traceId}] Authenticating user...`);

        user = await authenticateUser(token);

        console.log(`[${traceId}] ✓ User authenticated:`, user?.email || user);
      } catch (authErr) {
        console.error(`[${traceId}] ❌ AUTH ERROR:`, authErr.message);

        return res.status(401).json({
          error: "Invalid token",
          details: authErr.message,
        });
      }

      // =========================================
      // CREATE MCP SERVER
      // =========================================

      console.log(`[${traceId}] Creating MCP server...`);

      const server = createMcpServer();

      console.log(`[${traceId}] ✓ MCP server created`);

      // =========================================
      // TRANSPORT
      // =========================================

      console.log(`[${traceId}] Creating transport...`);

      // stateless mode: each POST /mcp is fully self-contained
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      console.log(`[${traceId}] ✓ Transport created`);

      // ── Parse and log the request body to see what ChatGPT sent ──
      let parsedBody;
      try {
        if (Buffer.isBuffer(req.body)) {
          parsedBody = JSON.parse(req.body.toString("utf-8"));
        } else if (typeof req.body === "string") {
          parsedBody = JSON.parse(req.body);
        } else {
          parsedBody = req.body;
        }
      } catch (e) {
        parsedBody = req.body;
      }

      // Log the MCP method and params (this is the key diagnostic)
      const mcpMethod = parsedBody?.method;
      const mcpId = parsedBody?.id;
      console.log(`[${traceId}] MCP Request: method=${mcpMethod}, id=${mcpId}`);

      // If it's a tools/call, log which tool and the arguments
      if (mcpMethod === "tools/call") {
        const toolName = parsedBody?.params?.name;
        const toolArgs = parsedBody?.params?.arguments;
        console.log(`[${traceId}] 📞 TOOL CALL: "${toolName}"`);
        console.log(`[${traceId}] Tool arguments keys:`, toolArgs ? Object.keys(toolArgs) : "(none)");

        // Log file argument details without exposing full URLs
        if (toolArgs?.file) {
          const f = toolArgs.file;
          console.log(`[${traceId}] File argument received:`);
          console.log(`[${traceId}]   - has download_url: ${!!f.download_url}`);
          console.log(`[${traceId}]   - has file_id: ${!!f.file_id}`);
          console.log(`[${traceId}]   - has path: ${!!f.path}`);
          console.log(`[${traceId}]   - file_name: ${f.file_name || "(not set)"}`);
          console.log(`[${traceId}]   - mime_type: ${f.mime_type || "(not set)"}`);
          console.log(`[${traceId}]   - download_url length: ${f.download_url?.length || 0}`);
        } else {
          console.log(`[${traceId}] ⚠️ No "file" key in tool arguments!`);
          console.log(`[${traceId}] Full arguments:`, JSON.stringify(toolArgs, null, 2));
        }
      } else if (mcpMethod === "tools/list") {
        console.log(`[${traceId}] 📋 Tool discovery request (tools/list)`);
      } else if (mcpMethod === "initialize") {
        console.log(`[${traceId}] 🔌 MCP initialize handshake`);
      }

      await authStorage.run(user, async () => {
        console.log(`[${traceId}] Connecting MCP server...`);

        await server.connect(transport);

        console.log(`[${traceId}] ✓ Server connected, handling request...`);

        await transport.handleRequest(req, res, parsedBody);

        console.log(`[${traceId}] ✓ Request handled successfully`);
      });
    } catch (err) {
      console.error(`[${traceId}] ❌ MCP ERROR`);
      console.error(`[${traceId}] Message:`, err.message);
      console.error(`[${traceId}] Stack:`, err.stack);

      if (err.cause) {
        console.error(`[${traceId}] Cause:`, err.cause);
      }

      console.error(`[${traceId}] Full Error:`, err);
      console.error("====================================");

      if (!res.headersSent) {
        return res.status(500).json({
          error: "Internal Server Error",
          message: err.message,
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
      }
    }
  });

  console.log("✓ /mcp route added");
}

export { addMcpRoutes };
