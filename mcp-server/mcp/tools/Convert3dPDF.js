import fs from "fs";
import { uploadContext } from "./upload-store.js";
import { verifyToken } from "../../auth/middleware.js";
import {
  createJob,
  getSignedUploadUrl,
  generateSignedS3DownloadUrl,
  uploadZipToS3,
  finishUpload,
  submitJob,
  getjobstatus,
  deleteFileFromBucket,
} from "../service/apsservice.js";
import { API_ENDPOINTS } from "../../config/api-urls.js";
import config from "../../config/config.json" with { type: "json" };

const step = "[convert_iam_file]";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollJobStatus(userId,jobId, firebaseToken, maxAttempts = 40) {
  const STATUS_MAP = {
    pending: "Preparing your file...",
    inprogress: "Converting your file...",
    success: "Ready to download",
    failed: "Conversion failed. Please try again.",
    failedInstructions: "Conversion failed due to invalid input.",
    failedDownload: "Download failed. Please retry.",
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`${step} Polling job status (attempt ${attempt + 1}/${maxAttempts})...`);
    const response = await getjobstatus(userId, jobId, firebaseToken);
    const status = response.status;
    console.log(`${step} Status: ${STATUS_MAP[status] || "Processing..."}`);

    if (status === "success") {
      return response;
    }

    if (status === "failed" || status === "failedInstructions" || status === "failedDownload") {
      console.error(`${step} Job failed with status: ${status}`);
      return response;
    }

    await sleep(23000);
  }

  throw new Error("Timed out waiting for conversion.");
}

export async function convert_iam_file({ selectedIamFile }) {
  console.log(`${step} === START convert_iam_file ===`);
  console.log(`${step} selectedIamFile: ${selectedIamFile}`);

  // ── Step 0: Validate prerequisites ──
  const firebaseToken = uploadContext.firebaseToken;
  if (!firebaseToken) {
    console.error(`${step} No firebase token in uploadContext`);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: "Not authenticated. Please upload a ZIP first." }) }],
    };
  }

  if (!uploadContext.localFilePath) {
    console.error(`${step} No ZIP file path in uploadContext`);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: "No ZIP file uploaded. Please upload a ZIP first." }) }],
    };
  }

  uploadContext.selectedIamFile = selectedIamFile;

  // Diagnostic: show what we're working with
  console.log(`${step} Using ZIP from: ${uploadContext.localFilePath}`);
  console.log(`${step} ZIP file name: ${uploadContext.zipFileName}`);
  console.log(`${step} API endpoints:`);
  console.log(`  - createJob: ${API_ENDPOINTS.createJob}`);
  console.log(`  - submitJob: ${API_ENDPOINTS.submitJob}`);

  // Derive output filename from the selected IAM file
  const baseName = selectedIamFile.replace(/\.iam$/i, "");
  const outputFileName = `${baseName}_3dpdf.zip`;
  console.log(`${step} Output filename: ${outputFileName}`);

  // ── Step 1: Create job ──
  let jobResponse;
  try {
    console.log(`${step} Creating job...`);
    console.log(`${step} Firebase token present: ${!!firebaseToken}`);
    jobResponse = await createJob(firebaseToken);

    uploadContext.jobId = jobResponse.jobId;
    uploadContext.objectKey = `${jobResponse.jobId}_${uploadContext.zipFileName}`;
    console.log(`${step} Job created, jobId=${jobResponse.jobId}, objectKey=${uploadContext.objectKey}`);
  } catch (err) {
    console.error(`API_ENDPOINTS.createJob`, err.response);
    console.error(`${step} Error creating job:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to create job: ${err.message}` }) }],
    };
  }

  // ── Step 2: Get signed upload URL for the ZIP ──
  let signedResponse;
  try {
    console.log(`${step} Getting signed upload URL...`);
    signedResponse = await getSignedUploadUrl(uploadContext.objectKey, firebaseToken);
    console.log(`${step} Got signed upload URL`);
  } catch (err) {
    console.error(`${step} Error getting signed upload URL:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to get upload URL: ${err.message}` }) }],
    };
  }

  // ── Step 3: Upload the ZIP file to S3 ──
  try {
    console.log(`${step} Uploading ZIP to S3 from: ${uploadContext.localFilePath}`);
    await uploadZipToS3(signedResponse.uploadUrl, uploadContext.localFilePath);
    console.log(`${step} ZIP uploaded to S3`);
  } catch (err) {
    console.error(`${step} Error uploading ZIP to S3:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to upload ZIP: ${err.message}` }) }],
    };
  }

  // ── Step 4: Finish upload ──
  try {
    console.log(`${step} Finishing upload...`);
    await finishUpload(uploadContext.objectKey, signedResponse.uploadKey, firebaseToken);
    console.log(`${step} Upload finalized`);
  } catch (err) {
    console.error(`${step} Error finishing upload:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to finalize upload: ${err.message}` }) }],
    };
  }

  // ── Step 5: Generate signed download URL for the uploaded ZIP ──
  let inputZipUrl;
  try {
    console.log(`${step} Generating download URL for input ZIP...`);
    const res = await generateSignedS3DownloadUrl(signedResponse.objectName, firebaseToken);
    inputZipUrl = res.downloadUrl;
    console.log(`${step} Got input ZIP download URL`);
  } catch (err) {
    console.error(`${step} Error generating download URL:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to get download URL: ${err.message}` }) }],
    };
  }

  // ── Step 6: Upload params.json ──
  let inputparamUrl;
  try {
    console.log(`${step} Uploading params.json...`);
    const params = {
      quality: config.quality,
      outputfilename: outputFileName,
    };

    // Write params.json to a temp file (Node.js — not browser File/Blob)
    const tmpParamsPath = `params_${Date.now()}.json`;
    fs.writeFileSync(tmpParamsPath, JSON.stringify(params));

    const paramsUpload = await getSignedUploadUrl("params.json", firebaseToken);
    await uploadZipToS3(paramsUpload.uploadUrl, tmpParamsPath);
    await finishUpload("params.json", paramsUpload.uploadKey, firebaseToken);

    const res = await generateSignedS3DownloadUrl(paramsUpload.objectName, firebaseToken);
    inputparamUrl = res.downloadUrl;

    // Clean up temp file
    try { fs.unlinkSync(tmpParamsPath); } catch (_) {}

    console.log(`${step} params.json uploaded`);
  } catch (err) {
    console.error(`${step} Error uploading params.json:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to upload params: ${err.message}` }) }],
    };
  }

  // ── Step 7: Get signed output URL ──
  let outputUrl;
  let outputUploadParams;
  try {
    console.log(`${step} Getting output signed URL for: ${outputFileName}`);
    outputUploadParams = await getSignedUploadUrl(outputFileName, firebaseToken);
    uploadContext.outputUrl = outputUploadParams.uploadUrl;
    console.log(`${step} Got output signed URL`);
  } catch (err) {
    console.error(`${step} Error getting output signed URL:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to get output URL: ${err.message}` }) }],
    };
  }

  // ── Step 8: Submit the conversion job ──
  let workItemId;
  try {
    console.log(`${step} Submitting conversion job...`);
    const res = await submitJob(
      uploadContext.jobId,
      firebaseToken,
      inputZipUrl,
      uploadContext.outputUrl,
      selectedIamFile,
      inputparamUrl,
      outputFileName
    );

    console.log(`${step} Submit response:`, JSON.stringify(res));
    workItemId = res.id || res.workItemId || res.data?.id;

    if (!workItemId) {
      throw new Error("No work item ID returned from submitJob");
    }
    console.log(`${step} Job submitted, workItemId=${workItemId}`);
  } catch (err) {
    console.error(`${step} Error submitting job:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to submit job: ${err.message}` }) }],
    };
  }

  // ── Step 9: Poll for completion ──
  let finalResult;
  try {
    console.log(`${step} Polling for conversion result...`);
    const decoded = await verifyToken(firebaseToken);
    console.log("Decoded token:", decoded);
        const userId = decoded.user_id;
        console.log( "Decoded user ID from token: ", userId);
        console.log("firebaseToken", firebaseToken);
    finalResult = await pollJobStatus(userId, workItemId, firebaseToken);
    console.log(`${step} Poll finished with status: ${finalResult.status}`);
  } catch (err) {
    console.error(`${step} Error polling job:`, err.message);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Polling failed: ${err.message}` }) }],
    };
  }

  // ── Step 10: Finalize and return download URL ──
  if (finalResult.status === "success") {
    try {
      console.log(`${step} Finalizing output upload...`);
      await finishUpload(outputFileName, uploadContext.outputUrl, firebaseToken);

      const downloadRes = await generateSignedS3DownloadUrl(outputFileName, firebaseToken);
      uploadContext.status = "success";

      console.log(`${step} === END convert_iam_file (SUCCESS) ===`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "SUCCESS",
              message: "Your 3D PDF is ready to download.",
              downloadUrl: downloadRes.downloadUrl,
              selectedIamFile,
              outputFileName,
            }),
          },
        ],
      };
    } catch (err) {
      console.error(`${step} Error finalizing download:`, err.message);
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "ERROR", message: `Failed to finalize download: ${err.message}` }) }],
      };
    }
  } else {
    console.log(`${step} === END convert_iam_file (FAILED: ${finalResult.status}) ===`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "FAILED",
            message: `Conversion failed with status: ${finalResult.status}`,
            selectedIamFile,
          }),
        },
      ],
    };
  }
}
