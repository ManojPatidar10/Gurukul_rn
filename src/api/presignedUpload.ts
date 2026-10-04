import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * The presigned S3 URLs sign Content-Length, so the presign must declare the exact byte count and
 * the PUT must send exactly those bytes. Reading the picked image into a Blob with fetch() and
 * PUTting that is unreliable on React Native (the bytes sent don't always match blob.size, and S3
 * rejects the signature), so on device the file is read and uploaded natively from disk instead.
 */
export async function pickedFileSize(uri: string, reportedSize: number): Promise<number> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return blob.size || reportedSize;
  }
  return new File(uri).size || reportedSize;
}

export async function putToPresignedUrl(uploadUrl: string, uri: string, contentType: string): Promise<void> {
  let status: number;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    status = (await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob })).status;
  } else {
    status = (await new File(uri).upload(uploadUrl, { httpMethod: 'PUT', headers: { 'Content-Type': contentType } })).status;
  }
  if (status < 200 || status >= 300) throw new Error(`Upload to storage failed (HTTP ${status})`);
}
