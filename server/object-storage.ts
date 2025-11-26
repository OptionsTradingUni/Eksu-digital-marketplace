import { Client } from "@replit/object-storage";

const client = new Client();

export async function uploadToObjectStorage(
  file: Express.Multer.File,
  prefix: string = ""
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.originalname.split('.').pop() || 'jpg';
    const objectName = `${prefix}${timestamp}-${randomId}.${extension}`;
    
    const { ok, error } = await client.uploadFromBytes(objectName, file.buffer);
    
    if (!ok) {
      console.error("Object storage upload error:", error);
      return null;
    }
    
    return objectName;
  } catch (error) {
    console.error("Object storage upload failed:", error);
    return null;
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
  try {
    const { ok, value, error } = await client.downloadAsBytes(objectName);
    if (!ok) {
      console.error("Object storage download error:", error);
      return null;
    }
    // value is [Buffer] tuple, extract the buffer
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

export { client as objectStorageClient };
