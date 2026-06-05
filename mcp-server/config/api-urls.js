import configurl from "./env.js";

export const API_ENDPOINTS = {
  createJob: `${configurl.apiBaseUrl}/user/createJobId`,
  getSignedUploadUrl: `${configurl.apiBaseUrl}/user/uploadUrl`,
  generateSignedS3DownloadUrl: `${configurl.apiBaseUrl}/user/downloadUrl`,
  finishUpload: `${configurl.apiBaseUrl}/user/finishUpload`,
  deleteFileFromBucket: `${configurl.apiBaseUrl}/user/deleteFiles`,
  submitJob: `${configurl.apiBaseUrl}/user/submitWorkItem`,
  getJobStatus: `${configurl.apiBaseUrl}/user/jobstatus`,
  pollWorkItem: `${configurl.apiBaseUrl}/user/pollWorkItem`,
};
  
   



