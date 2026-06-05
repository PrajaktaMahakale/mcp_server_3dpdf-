export async function Check_status({workItemId}){
    console.log("Checking job status for workItemId:", workItemId);
   let finalResult;
  try {
     const firebaseToken = uploadContext.firebaseToken;
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