import { backupOf, readStudyStore } from "./studyStorage";
import { studyTracker } from "./studyTrackingService";
import { backupReminder } from "../../utils/backupReminder";

/** Resolves after generation and download initiation, not physical file storage. */
export async function exportStudyBackup() {
    await studyTracker.seal();
    const backup = backupOf(readStudyStore());
    const stamp = backup.exportedAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const mobile = window.matchMedia("(pointer: coarse) and (max-width: 820px)").matches;
    const device = mobile ? "mobile" : "desktop";
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bej-study-backup-${device}-${stamp}.json`;
    try { document.body.appendChild(anchor); anchor.click(); }
    finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    backupReminder.exported();
}
