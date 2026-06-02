import { spawn } from "child_process";
import { createGzip } from "zlib";
import { objectStorageClient } from "./replit_integrations/object_storage";

const SIDECAR = "http://127.0.0.1:1106";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return {
    bucketName: parts[1],
    objectName: parts.slice(2).join("/"),
  };
}

function getBackupPrefix(): { bucketName: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set — Object Storage not configured.");
  const base = dir.endsWith("/") ? dir : `${dir}/`;
  const { bucketName, objectName } = parseObjectPath(`${base}backups`);
  return { bucketName, objectName: objectName + "/" };
}

async function signedUrl(
  bucketName: string,
  objectName: string,
  method: "GET" | "PUT",
  ttlSec: number
): Promise<string> {
  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sign URL (${res.status}): ${text}`);
  }
  const { signed_url } = await res.json();
  return signed_url;
}

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}

/**
 * Run pg_dump, gzip the output, and upload directly to Object Storage.
 * Returns the backup filename.
 */
export async function createBackup(): Promise<{ filename: string; sizeBytes: number }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set.");

  const { bucketName, prefix } = getBackupPrefix();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const filename = `backup_${ts}.sql.gz`;
  const objectName = `${prefix}${filename}`;

  const uploadUrl = await signedUrl(bucketName, objectName, "PUT", 3600);

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn("pg_dump", [dbUrl, "--no-password"], {
      env: { ...process.env, PGPASSWORD: "" },
    });

    const gzip = createGzip({ level: 6 });

    pgDump.stderr.on("data", (d: Buffer) => {
      const msg = d.toString();
      if (!msg.includes("NOTICE") && !msg.includes("pg_dump:")) {
        console.warn("[backup] pg_dump stderr:", msg.trim());
      }
    });

    gzip.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
    });

    gzip.on("end", () => resolve());
    gzip.on("error", reject);
    pgDump.on("error", reject);
    pgDump.stderr.on("error", () => {});

    pgDump.stdout.pipe(gzip);

    pgDump.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
  });

  const body = Buffer.concat(chunks);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(body.length),
    },
    body,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  console.log(`[backup] Uploaded ${filename} (${body.length} bytes) to Object Storage`);
  return { filename, sizeBytes: body.length };
}

/**
 * List all backups stored in Object Storage, newest first.
 * Each entry includes a short-lived signed download URL.
 */
export async function listBackups(): Promise<BackupFile[]> {
  const { bucketName, prefix } = getBackupPrefix();
  const bucket = objectStorageClient.bucket(bucketName);

  const [files] = await bucket.getFiles({ prefix });

  const results: BackupFile[] = [];

  for (const file of files) {
    const name = file.name.split("/").pop();
    if (!name || !name.endsWith(".sql.gz")) continue;

    const [meta] = await file.getMetadata();
    const sizeBytes = Number(meta.size ?? 0);
    const createdAt = (meta.timeCreated as string) ?? new Date().toISOString();

    const downloadUrl = await signedUrl(bucketName, file.name, "GET", 3600);

    results.push({ name, sizeBytes, createdAt, downloadUrl });
  }

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}
