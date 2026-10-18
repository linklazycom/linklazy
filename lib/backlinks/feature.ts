import { isFeatureEnabled } from "@/lib/feature-flags";

export const BACKLINK_FEATURE_FLAG = "feature_backlink_monitor";

/** Kill-switch: the feature's own switch AND the global "all external calls" switch must be on (default: on). */
export function isBacklinkMonitorOn(): Promise<boolean> {
  return isFeatureEnabled(BACKLINK_FEATURE_FLAG);
}
