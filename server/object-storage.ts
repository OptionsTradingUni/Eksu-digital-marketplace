import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import path from "path";

let cloudinaryConfigured = false;

function initCloudinary(): boolean {
  if (cloudinaryConfigured) {
    return true;
  }
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    cloudinaryConfigured = true;
    console.log("Cloudinary storage initialized successfully");
    return true;
  }
  
  console.log("Cloudinary not configured, falling back to disk storage");
  return false;
}

initCloudinary();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function uploadToDisk(file: Express.Multer.File): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.originalname.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${randomId}.${extension}`;
    const filepath = path.join(uploadDir, filename);
    
    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error("Disk upload failed:", error);
    return null;
  }
}

async function uploadToCloudinary(
  file: Express.Multer.File,
  folder: string = "eksu-marketplace"
): Promise<string | null> {
  try {
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    const result: UploadApiResponse = await cloudinary.uploader.upload(base64Data, {
      folder: folder,
      resource_type: "auto",
      transformation: [
        { quality: "auto:good" },
        { fetch_format: "auto" }
      ]
    });
    
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return null;
  }
}

export async function uploadToObjectStorage(
  file: Express.Multer.File,
  prefix: string = ""
): Promise<string | null> {
  const isConfigured = initCloudinary();
  
  if (isConfigured) {
    const folder = prefix ? `eksu-marketplace/${prefix.replace(/\/$/, '')}` : "eksu-marketplace";
    const url = await uploadToCloudinary(file, folder);
    if (url) {
      return url;
    }
  }
  
  return uploadToDisk(file);
}

export async function uploadMultipleToObjectStorage(
  files: Express.Multer.File[],
  prefix: string = ""
): Promise<string[]> {
  const uploadPromises = files.map(file => uploadToObjectStorage(file, prefix));
  const results = await Promise.all(uploadPromises);
  return results.filter((url): url is string => url !== null);
}

export async function uploadVideoToStorage(
  file: Express.Multer.File,
  prefix: string = ""
): Promise<string | null> {
  const isConfigured = initCloudinary();
  
  if (isConfigured) {
    try {
      const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const folder = prefix ? `eksu-marketplace/${prefix.replace(/\/$/, '')}` : "eksu-marketplace/videos";
      
      const result: UploadApiResponse = await cloudinary.uploader.upload(base64Data, {
        folder: folder,
        resource_type: "video",
        eager: [
          { quality: "auto" }
        ]
      });
      
      return result.secure_url;
    } catch (error) {
      console.error("Cloudinary video upload failed:", error);
    }
  }
  
  return uploadToDisk(file);
}

export async function deleteFromStorage(url: string): Promise<boolean> {
  if (!url) return false;
  
  if (url.includes('cloudinary.com')) {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1) {
        const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
        
        await cloudinary.uploader.destroy(publicId);
        return true;
      }
    } catch (error) {
      console.error("Cloudinary delete failed:", error);
      return false;
    }
  }
  
  if (url.startsWith('/uploads/')) {
    try {
      const filename = url.replace('/uploads/', '');
      const filepath = path.join(uploadDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
    } catch (error) {
      console.error("Disk delete failed:", error);
    }
  }
  
  return false;
}

export async function getObjectUrl(objectName: string): Promise<string | null> {
  return null;
}

export async function deleteFromObjectStorage(objectName: string): Promise<boolean> {
  return deleteFromStorage(objectName);
}

export async function listObjects(prefix: string = ""): Promise<string[]> {
  return [];
}

export function getClient(): null {
  return null;
}

export function isCloudinaryConfigured(): boolean {
  return cloudinaryConfigured;
}

export { initCloudinary as initObjectStorage, cloudinaryConfigured as objectStorageAvailable };
