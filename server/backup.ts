import { spawn } from "child_process";
import { createGzip } from "zlib";
import { objectStorageClient } from "./replit_integrations/object_storage";

const SIDECAR = "http://127.0.0.1:1106";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function getBackupPrefix(): { bucketName: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set — Object Storage not configured.");
  const base = dir.endsWith("/") ? dir : `${dir}/`;
  const { bucketName, objectName } = parseObjectPath(`${base}backups`);
  return { bucketName, prefix: objectName + "/" };
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
  if (!res.ok) throw new Error(`Failed to sign URL (${res.status}): ${await res.text()}`);
  const { signed_url } = await res.json();
  return signed_url;
}

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
  source: "google-drive" | "object-storage";
}

// ─── Dump helper ─────────────────────────────────────────────────────────────

async function runPgDumpGzip(): Promise<Buffer> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set.");

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn("pg_dump", [dbUrl, "--no-password"], {
      env: { ...process.env, PGPASSWORD: "" },
    });
    const gzip = createGzip({ level: 6 });

    let pgDumpExitCode: number | null = null;
    let gzipDone = false;

    function tryResolve() {
      if (!gzipDone || pgDumpExitCode === null) return;
      if (pgDumpExitCode === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${pgDumpExitCode}`));
    }

    pgDump.stderr.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg && !msg.startsWith("pg_dump: last built-in OID")) {
        console.warn("[backup] pg_dump stderr:", msg);
      }
    });

    gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gzip.on("end", () => { gzipDone = true; tryResolve(); });
    gzip.on("error", (err) => reject(new Error(`Gzip error: ${err.message}`)));
    pgDump.on("error", (err) => reject(new Error(`pg_dump spawn error: ${err.message}`)));
    pgDump.on("close", (code) => { pgDumpExitCode = code ?? 1; tryResolve(); });
    pgDump.stdout.pipe(gzip);
  });

  return Buffer.concat(chunks);
}

// ─── createBackup ─────────────────────────────────────────────────────────────

/**
 * Dump the database, gzip it, then upload to Google Drive (primary).
 * Falls back to Object Storage if Google Drive is unavailable.
 */
export async function createBackup(): Promise<{ filename: string; sizeBytes: number; source: "google-drive" | "object-storage" }> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const filename = `backup_${ts}.sql.gz`;

  const body = await runPgDumpGzip();

  // ── Try Google Drive first ──────────────────────────────────────────────
  try {
    const { uploadBackupToDrive } = await import("./googleDrive");
    await uploadBackupToDrive(filename, body);
    return { filename, sizeBytes: body.length, source: "google-drive" };
  } catch (driveErr: any) {
    console.warn("[backup] Google Drive upload failed, falling back to Object Storage:", driveErr.message);
  }

  // ── Object Storage fallback ─────────────────────────────────────────────
  const { bucketName, prefix } = getBackupPrefix();
  const objectName = `${prefix}${filename}`;
  const uploadUrl = await signedUrl(bucketName, objectName, "PUT", 3600);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/gzip", "Content-Length": String(body.length) },
    body,
  });
  if (!uploadRes.ok) throw new Error(`Object Storage upload failed: ${uploadRes.status}`);

  console.log(`[backup] Uploaded ${filename} (${body.length} bytes) to Object Storage`);
  return { filename, sizeBytes: body.length, source: "object-storage" };
}

// ─── listBackups ──────────────────────────────────────────────────────────────

/**
 * List backups from Google Drive (primary), falling back to Object Storage.
 */
export async function listBackups(): Promise<BackupFile[]> {
  // ── Try Google Drive first ──────────────────────────────────────────────
  try {
    const { listDriveBackups } = await import("./googleDrive");
    const driveFiles = await listDriveBackups();
    return driveFiles.map((f) => ({
      name: f.name,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt,
      downloadUrl: f.viewUrl,
      source: "google-drive" as const,
    }));
  } catch (driveErr: any) {
    console.warn("[backup] Google Drive listing failed, falling back to Object Storage:", driveErr.message);
  }

  // ── Object Storage fallback ─────────────────────────────────────────────
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
    results.push({ name, sizeBytes, createdAt, downloadUrl, source: "object-storage" });
  }

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}
