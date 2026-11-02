"use client";

import { createContext, useContext } from "react";

/**
 * The tool switches (Admin > Tools & features) for client components inside the dashboard. The dashboard layout fills it in;
 * admins get an empty map (everything on) so they can still test a tool that is switched off. Outside the provider every
 * tool counts as ON, so a missing provider can only ever show a button, never hide one by mistake.
 */
const ToolFlagsContext = createContext<Record<string, boolean>>({});

export function ToolFlagsProvider({ flags, children }: { flags: Record<string, boolean>; children: React.ReactNode }) {
  return <ToolFlagsContext.Provider value={flags}>{children}</ToolFlagsContext.Provider>;
}

/** True unless this tool's switch is explicitly OFF. */
export function useToolOn(flagKey: string): boolean {
  return useContext(ToolFlagsContext)[flagKey] !== false;
}
