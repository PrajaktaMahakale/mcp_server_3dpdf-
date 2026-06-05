import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { upload_zip_file } from "./tools/uploadZipFile.js";
import { convert_iam_file } from "./tools/Convert3dPDF.js";
import {uploadContext} from "./tools/upload-store.js";

// ChatGPT-compatible file parameter schema
// When "openai/fileParams" is set, ChatGPT replaces the field value
// with { download_url, file_id, mime_type?, file_name? }
const chatGptFileSchema = z.object({
  download_url: z.string().describe("Temporary URL to download the file"),
  file_id: z.string().describe("ChatGPT file identifier"),
  mime_type: z.string().optional().describe("MIME type of the file"),
  file_name: z.string().optional().describe("Original file name"),
});

export function createMcpServer() {
  const server = new McpServer({
    name: "inventor-mcp-server",
    version: "1.0.0",
  });

  // =============================================
  // TOOL: upload_zip_file (with ChatGPT file support)
  // =============================================
  // Use registerTool() instead of tool() so we can pass _meta
  // with openai/fileParams — this tells the ChatGPT connector runtime
  // that the "file" argument is a file slot, so it can rewrite the
  // uploaded file path before invoking the tool (fixes the
  // "File arg rewrite paths are required when proxied mounts are present" error).
  server.registerTool(
    "upload_zip_file",
    {
      title: "Upload ZIP File",
      description:
        "Upload a ZIP archive containing Inventor assembly files. " +
        "The tool extracts and lists all .iam files found inside the ZIP. " +
        "After listing, the user can choose which IAM file to convert to 3D PDF.",
      inputSchema: {
        file: chatGptFileSchema,
      },
      _meta: {
        "openai/fileParams": ["file"],
      },
    },
    async ({ file }) => {
      console.log("[upload_zip_file] Tool handler invoked");
      console.log("[upload_zip_file] Raw file argument:", JSON.stringify(file, null, 2));
      try {
        const result = await upload_zip_file({ file });
        console.log("[upload_zip_file] Tool handler completed successfully");
        return result;
      } catch (err) {
        console.error("[upload_zip_file] Tool handler error:", err.message);
        throw err;
      }
    }
  );



  // =============================================
  // TOOL: convert_iam_file (uses ZIP from uploadContext)
  // =============================================
  // No file upload here — the ZIP is already stored in uploadContext
  // from the upload_zip_file step. This tool just takes the IAM file
  // name the user selected and kicks off the conversion pipeline.
  server.registerTool(
    "convert_iam_file",
    {
      title: "Convert IAM File to 3D PDF",
      description:
        "Convert a selected IAM assembly file to 3D PDF. " +
        "Use this AFTER upload_zip_file has listed the available IAM files. " +
        "Pass the exact IAM file name from the list returned by upload_zip_file.",
      inputSchema: {
        selectedIamFile: z.string().describe(
          "The exact file name of the IAM assembly to convert (must be one of the names returned by upload_zip_file)"
        ),
      },
    },
    async ({ selectedIamFile }) => {
      console.log("[convert_iam_file] Tool handler invoked");
      console.log("[convert_iam_file] selectedIamFile:", selectedIamFile);
      try {
        const result = await convert_iam_file({ selectedIamFile });
        console.log("[convert_iam_file] Tool handler completed successfully");
        return result;
      } catch (err) {
        console.error("[convert_iam_file] Tool handler error:", err.message);
        throw err;
      }
    }
  );

// server.registerTool(
//   "check_status",
//   {
//     title: "Check Conversion Status",
//     description:
//       "Checks the status of the latest Inventor to 3D PDF conversion and returns the download URL when completed.",
//     inputSchema: {
//       type: "object",
//       properties: {},
//     },
//   },
//   async ({}, extra) => {
//     try {

     

//       // Get active job from DB/cache
//       const activeJob = await Check_status(uploadContext.workItemId);

//       if (!activeJob) {
//         return {
//           content: [
//             {
//               type: "text",
//               text: JSON.stringify({
//                 status: "ERROR",
//                 message: "No active conversion found.",
//               }),
//             },
//           ],
//         };
//       }

//       const status = await getJobStatus(
//         userId,
//         activeJob.workItemId,
//         firebaseToken
//       );

//       if (status !== "success") {
//         return {
//           content: [
//             {
//               type: "text",
//               text: JSON.stringify({
//                 status,
//                 message: "Conversion is still in progress.",
//               }),
//             },
//           ],
//         };
//       }

//       await finishUpload(
//         activeJob.outputFileName,
//         activeJob.uploadKey,
//         firebaseToken
//       );

//       const downloadRes =
//         await generateSignedS3DownloadUrl(
//           activeJob.outputFileName,
//           firebaseToken
//         );

//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify({
//               status: "SUCCESS",
//               message: "Your 3D PDF is ready to download.",
//               downloadUrl: downloadRes.downloadUrl,
//             }),
//           },
//         ],
//       };
//     } catch (err) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify({
//               status: "ERROR",
//               message: err.message,
//             }),
//           },
//         ],
//       };
//     }
//   }
// );
  
  return server;
}
