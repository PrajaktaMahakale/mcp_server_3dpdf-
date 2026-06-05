import axios from "axios";
import fs from "fs";
import { API_ENDPOINTS } from "../../config/api-urls.js";


export async function createJob(token) {
  const response = await axios.get(
    API_ENDPOINTS.createJob,
    {
      headers: {
        "x-firebase-token": token,
      },
    }
  );

  console.log("Job creation response:", response.data);
  return response.data;
}

export async function getSignedUploadUrl(zipName, firebaseToken) {
  try {
    const response = await axios.post(
      API_ENDPOINTS.getSignedUploadUrl,
      {
        zipName: zipName
      },
      {
        headers: {
          'x-firebase-token': firebaseToken
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting signed upload URL:", error);
    throw error;
  }
}

export async function generateSignedS3DownloadUrl(zipName, firebaseToken) {
  try {
    const response = await axios.post(
      API_ENDPOINTS.generateSignedS3DownloadUrl,
      {

        zipName: zipName
      }, {
      headers: {
        'x-firebase-token': firebaseToken
      }
    }

    );
    return response.data;
  } catch (error) {
    console.error("Error generating signed S3 download URL:", error);
    throw error;
  }
}

export async function uploadZipToS3(uploadUrl, filePathOrBuffer) {
  try {
    const data = typeof filePathOrBuffer === 'string'
      ? fs.readFileSync(filePathOrBuffer)
      : filePathOrBuffer;
    await axios.put(uploadUrl, data, {
      headers: {
        'Content-Type': 'application/zip'
      }
    });
  } catch (error) {
    console.error("Error uploading ZIP to S3:", error);
    throw error;
  }
}

export async function finishUpload(zipName, uploadKey, firebaseToken) {
  try {
    await axios.post(
      API_ENDPOINTS.finishUpload,
      {
        zipName: zipName,
        uploadKey: uploadKey
      },
      {
        headers: {
          'x-firebase-token': firebaseToken
        }
      }
    );
  } catch (error) {
    console.error("Error finishing upload:", error);
    throw error;
  }
}

export async function submitJob(jobId, firebaseToken, inputZipUrl, outputUrl, assembly, inputparamUrl, outputFileName) {
  try {
    const response = await axios.post(
      API_ENDPOINTS.submitJob,
      {
        jobId: jobId,
        inputZipUrl: inputZipUrl,
        outputUrl: outputUrl,
        assembly: assembly,
        inputparamUrl: inputparamUrl,
        outputFileName: outputFileName
      },
      {
        headers: {
          'x-firebase-token': firebaseToken
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error submitting job:", error);
    throw error;
  }
}

export async function pollWorkItemJob(worktemId, firebaseToken) {
  try {
    const response = await axios.post(
      API_ENDPOINTS.pollWorkItem,
      {
        workItemId: worktemId
      },
      {
        headers: {
          'x-firebase-token': firebaseToken
        }
      }


    );
    return response.data;
  } catch (error) {
    console.error("Error polling work item:", error);
    throw error;
  }
}
export async function getjobstatus(userId, jobId, firebaseToken) {
  try {
    const response = await axios.get(
      API_ENDPOINTS.getJobStatus,
      {
        params: {
          userId: userId,
          jobId: jobId
        },
        headers: {
          'x-firebase-token': firebaseToken
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting job status:", error);
    throw error;
  }
}
export async function deleteFileFromBucket(fileNames, firebaseToken) {
  try {
    await axios.delete(
      API_ENDPOINTS.deleteFileFromBucket,
      {
        fileName: fileNames
      },
      {
        headers: {
          'x-firebase-token': firebaseToken
        }
      }
    );
  } catch (error) {
    console.error("Error deleting file from bucket:", error);
    throw error;
  }
}   
