import { Client } from "@replit/object-storage";
import fs from "fs";
import path from "path";

let client: Client | null = null;
let objectStorageAvailable = false;

// Try to initialize object storage client
async function initObjectStorage(): Promise<boolean> {
  if (client !== null) {
    return objectStorageAvailable;
  }
  
  try {
    client = new Client();
    // Test if bucket is configured by trying a simple operation
    const testResult = await client.list({ prefix: "__test__" });
    objectStorageAvailable = testResult.ok;
    if (objectStorageAvailable) {
      console.log("Object storage initialized successfully");
    } else {
      console.log("Object storage not available, falling back to disk storage");
    }
  } catch (error) {
    console.log("Object storage not configured, falling back to disk storage");
    objectStorageAvailable = false;
  }
  
  return objectStorageAvailable;
}

// Initialize on module load - but don't block
initObjectStorage().catch(() => {});

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

export async function uploadToObjectStorage(
  file: Express.Multer.File,
  prefix: string = ""
): Promise<string | null> {
  // Check if object storage is available
  const isAvailable = await initObjectStorage();
  
  if (!isAvailable || !client) {
    // Fallback to disk storage
    return uploadToDisk(file);
  }
  
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.originalname.split('.').pop() || 'jpg';
    const objectName = `${prefix}${timestamp}-${randomId}.${extension}`;
    
    const { ok, error } = await client.uploadFromBytes(objectName, file.buffer);
    
    if (!ok) {
      console.error("Object storage upload error:", error);
      // Fallback to disk on error
      return uploadToDisk(file);
    }
    
    return `/storage/${objectName}`;
  } catch (error) {
    console.error("Object storage upload failed:", error);
    // Fallback to disk on exception
    return uploadToDisk(file);
  }
}

export async function uploadMultipleToObjectStorage(
  files: Express.Multer.File[],
  prefix: string = ""
): Promise<string[]> {
  const uploadPromises = files.map(file => uploadToObjectStorage(file, prefix));
  const results = await Promise.all(uploadPromises);
  return results.filter((url): url is string => url !== null);
}

export async function getObjectUrl(objectName: string): Promise<string | null> {
  const isAvailable = await initObjectStorage();
  if (!isAvailable || !client) {
    return null;
  }
  
  try {
    const { ok, value, error } = await client.downloadAsBytes(objectName);
    if (!ok) {
      console.error("Object storage download error:", error);
      return null;
    }
    const [buffer] = value;
    const base64 = buffer.toString('base64');
    const extension = objectName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 
                     extension === 'gif' ? 'image/gif' : 
                     extension === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("Object storage get URL failed:", error);
    return null;
  }
}

export async function deleteFromObjectStorage(objectName: string): Promise<boolean> {
  const isAvailable = await initObjectStorage();
  if (!isAvailable || !client) {
    return false;
  }
  
  try {
    const { ok, error } = await client.delete(objectName);
    if (!ok) {
      console.error("Object storage delete error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Object storage delete failed:", error);
    return false;
  }
}

export async function listObjects(prefix: string = ""): Promise<string[]> {
  const isAvailable = await initObjectStorage();
  if (!isAvailable || !client) {
    return [];
  }
  
  try {
    const { ok, value, error } = await client.list({ prefix });
    if (!ok) {
      console.error("Object storage list error:", error);
      return [];
    }
    return value.map(obj => obj.name);
  } catch (error) {
    console.error("Object storage list failed:", error);
    return [];
  }
}

export function getClient(): Client | null {
  return client;
}

export { initObjectStorage, objectStorageAvailable };
