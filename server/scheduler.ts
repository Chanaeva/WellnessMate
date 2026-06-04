import cron from "node-cron";
import { storage } from "./storage";
import { createBackup } from "./backup";
import { sendBackupAlertEmail } from "./email";

let scheduledTask: cron.ScheduledTask | null = null;

export type BackupSchedule = "disabled" | "daily" | "weekly";

function cronExpressionFor(schedule: BackupSchedule): string | null {
  switch (schedule) {
    case "daily":
      return "0 0 * * *";
    case "weekly":
      return "0 0 * * 0";
    default:
      return null;
  }
}

async function runScheduledBackup(schedule: BackupSchedule) {
  console.log(`[scheduler] Running ${schedule} scheduled backup…`);
  try {
    const result = await createBackup();
    console.log(`[scheduler] Scheduled backup complete: ${result.filename} (${result.sizeBytes} bytes)`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[scheduler] Scheduled backup FAILED:", msg);

    try {
      const adminEmailSetting = await storage.getSiteSetting("adminAlertEmail");
      const adminEmail = adminEmailSetting?.value;
      if (adminEmail) {
        await sendBackupAlertEmail(adminEmail, schedule, msg);
      } else {
        console.warn("[scheduler] No adminAlertEmail configured — skipping failure notification.");
      }
    } catch (emailErr: any) {
      console.error("[scheduler] Could not send failure notification email:", emailErr?.message);
    }
  }
}

export async function initBackupScheduler() {
  const setting = await storage.getSiteSetting("backupSchedule").catch(() => undefined);
  const schedule = (setting?.value ?? "disabled") as BackupSchedule;
  applySchedule(schedule);
}

export function applySchedule(schedule: BackupSchedule) {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[scheduler] Stopped previous backup schedule.");
  }

  const expr = cronExpressionFor(schedule);
  if (!expr) {
    console.log("[scheduler] Automatic database backups are disabled.");
    return;
  }

  scheduledTask = cron.schedule(expr, () => {
    runScheduledBackup(schedule);
  });

  console.log(`[scheduler] Backup schedule set to '${schedule}' (cron: ${expr})`);
}
