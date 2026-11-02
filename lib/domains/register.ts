import { registerTaskHandler } from "@/lib/tasks";
import { DOMAIN_RECHECK_TASK, handleDomainRecheckTask } from "@/lib/domains/recheck";

/** Import this module (for its side effect) in every route that runs the task queue. */
registerTaskHandler(DOMAIN_RECHECK_TASK, (task) => handleDomainRecheckTask(task));
