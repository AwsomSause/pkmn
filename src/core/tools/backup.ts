// F208: cloud-free backup reminder. The game only keeps saves in this browser, so after a while with no export it
// asks the player to save a copy. The last-export time lives on the device, not in a save. Pure.

export const BACKUP_REMINDER_DAYS = 7;

/** Whether to remind: only players who have something worth keeping, and not more than once per `BACKUP_REMINDER_DAYS`. */
export function backupDue(i: { runs: number; lastExportAt: string | null; lastRemindedAt: string | null; now: string }): boolean {
  if (i.runs < 1) return false;
  const day = 86_400_000;
  const since = (t: string | null) => (t === null ? Infinity : (Date.parse(i.now) - Date.parse(t)) / day);
  if (!(since(i.lastExportAt) >= BACKUP_REMINDER_DAYS)) return false;
  return since(i.lastRemindedAt) >= BACKUP_REMINDER_DAYS;
}
