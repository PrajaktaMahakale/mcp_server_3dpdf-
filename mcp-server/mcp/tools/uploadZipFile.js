import AdmZip from "adm-zip";
import axios from "axios";
import path from "path";
import fs from "fs";
import { uploadContext } from "./upload-store.js";

export async function upload_zip_file({ file }) {
  const step = "[upload_zip_file]";
  try {
    console.log(`${step} === START upload_zip_file ===`);
    console.log(`${step} Received file argument:`, JSON.stringify(file, null, 2));

    // ── Step 1: Validate input ──
    if (!file?.download_url && !file?.path) {
      console.log(`${step} ❌ File has neither download_url nor path`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "ERROR",
              message: "Uploaded file must have a download_url or path.",
              receivedFile: file,
            }),
          },
        ],
      };
    }
    console.log(`${step} ✓ File validation passed`);

    // ── Step 2: Get the file locally ──
    let localFilePath;

    // ChatGPT remote MCP: file comes as { download_url, file_id, mime_type?, file_name? }
    if (file.download_url) {
      console.log(`${step} Downloading file from download_url...`);
      console.log(`${step} download_url length: ${file.download_url.length}`);
      console.log(`${step} file_id: ${file.file_id}`);
      console.log(`${step} file_name: ${file.file_name || "(not set)"}`);
      console.log(`${step} mime_type: ${file.mime_type || "(not set)"}`);

      const response = await axios.get(file.download_url, {
        responseType: "arraybuffer",
      });
      console.log(`${step} ✓ Download complete, size: ${response.data.length} bytes`);

      const tmpDir = import.meta.dirname || ".";
      const fileName = file.file_name || "uploaded.zip";
      uploadContext.zipFile = file;
      localFilePath = path.join(tmpDir, `${Date.now()}_${fileName}`);
      fs.writeFileSync(localFilePath, Buffer.from(response.data));
      console.log(`${step} ✓ File saved locally to: ${localFilePath}`);
    } else {
      // Local/stdio MCP: file comes as { path }
      localFilePath = file.path;
      console.log(`${step} Using local file path: ${localFilePath}`);
    }

    // ── Step 3: Parse the ZIP ──
    console.log(`${step} Parsing ZIP file...`);
    const zip = new AdmZip(localFilePath);
    const entries = zip.getEntries();
    console.log(`${step} ✓ ZIP parsed, total entries: ${entries.length}`);

    // ── Step 4: Store in uploadContext ──
    uploadContext.zipFile = file;
    uploadContext.zipFileName = file.file_name || path.basename(localFilePath);
    uploadContext.localFilePath = localFilePath;
    console.log(`${step} ✓ uploadContext updated: zipFileName=${uploadContext.zipFileName}`);

    // ── Step 5: Find IAM files ──
    const iamFiles = entries
      .filter((entry) => entry.entryName.toLowerCase().endsWith(".iam"))
      .map((entry) => entry.entryName);

    console.log(`${step} IAM files found: ${iamFiles.length}`);
    iamFiles.forEach((f, i) => console.log(`${step}   [${i}] ${f}`));

    if (iamFiles.length === 0) {
      console.log(`${step} ❌ No IAM files found in ZIP`);
      // Log all entry names for debugging
      console.log(`${step} All ZIP entries:`);
      entries.forEach((e, i) => console.log(`${step}   [${i}] ${e.entryName}`));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "ERROR",
              message: "No IAM files found in the uploaded ZIP.",
            }),
          },
        ],
      };
    }

    uploadContext.iamFiles = iamFiles;

    console.log(`${step} ✓ === END upload_zip_file (SUCCESS) ===`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "SUCCESS",
            message: "Please choose an IAM file to convert.",
            iamFiles,
          }),
        },
      ],
    };
  } catch (error) {
    console.error(`[upload_zip_file] ❌ === END upload_zip_file (ERROR) ===`);
    console.error(`[upload_zip_file] Error:`, error.message);
    console.error(`[upload_zip_file] Stack:`, error.stack);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ERROR",
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
}