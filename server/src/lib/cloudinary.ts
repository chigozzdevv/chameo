import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config";

function ensureCloudinaryConfig(): void {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new Error("Cloudinary not configured");
  }
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

export async function uploadCampaignImage(params: {
  campaignId: string;
  buffer: Buffer;
  filename: string;
}): Promise<string> {
  ensureCloudinaryConfig();
  const folder = env.cloudinary.folder ? `${env.cloudinary.folder}/${params.campaignId}` : params.campaignId;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: params.filename,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );

    stream.end(params.buffer);
  });
}
