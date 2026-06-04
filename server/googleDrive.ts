/**
 * Google Drive integration for database backups.
 * Uses the Replit Connectors proxy — tokens are injected and refreshed automatically.
 * Never cache the ReplitConnectors instance; tokens expire.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

const FOLDER_NAME = "Wolf Mother Wellness Backups";

function client() {
  return new ReplitConnectors();
}

async function driveGet(path: string): Promise<any> {
  const res = await client().proxy("google-drive", path, { method: "GET" });
  return res.json();
}

// ─── Folder ────────────────────────────────────────────────────────────────

export async function getOrCreateBackupFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const search = await driveGet(`/drive/v3/files?q=${q}&fields=files(id,name)`);

  if (search.files?.length > 0) {
    return search.files[0].id as string;
  }

  const res = await client().proxy("google-drive", "/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = await res.json();
  if (!folder.id) throw new Error(`Could not create backup folder: ${JSON.stringify(folder)}`);
  console.log(`[googleDrive] Created folder "${FOLDER_NAME}" (${folder.id})`);
  return folder.id as string;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export async function uploadBackupToDrive(
  filename: string,
  content: Buffer
): Promise<{ fileId: string; viewUrl: string }> {
  const folderId = await getOrCreateBackupFolder();

  const boundary = `wmw_backup_${Date.now()}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  // Build a multipart/related body manually
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await client().proxy(
    "google-drive",
    "/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  const file = await res.json();
  if (!file.id) throw new Error(`Drive upload failed: ${JSON.stringify(file)}`);

  const viewUrl = `https://drive.google.com/file/d/${file.id}/view`;
  console.log(`[googleDrive] Uploaded ${filename} → ${viewUrl}`);
  return { fileId: file.id, viewUrl };
}

// ─── List ────────────────────────────────────────────────────────────────────

export interface DriveBackupFile {
  fileId: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  viewUrl: string;
}

export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const folderId = await getOrCreateBackupFolder();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,size,createdTime)");
  const orderBy = encodeURIComponent("createdTime desc");

  const data = await driveGet(
    `/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=50`
  );

  if (!data.files) return [];

  return (data.files as any[])
    .filter((f) => f.name?.endsWith(".sql.gz"))
    .map((f) => ({
      fileId: f.id,
      name: f.name,
      sizeBytes: Number(f.size ?? 0),
      createdAt: f.createdTime ?? new Date().toISOString(),
      viewUrl: `https://drive.google.com/file/d/${f.id}/view`,
    }));
}
