import { registerTaskHandler } from "@/lib/tasks";
import { BACKLINK_TASK, handleBacklinkCheckTask } from "@/lib/backlinks/task";

/** Import this module (for its side effect) in every route that runs the task queue. */
registerTaskHandler(BACKLINK_TASK, handleBacklinkCheckTask);
