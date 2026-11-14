"use client";
import { createContext, useContext } from "react";
import type { CrmState, Command, Modal } from "./types";
export type CrmContextValue = {
  state: CrmState;
  run: (command: Command, message?: string) => Promise<boolean>;
  user: {
    id: string;
    name: string;
    email: string;
    role: CrmState["role"];
  } | null;
  busy: boolean;
  open: (modal: Modal) => void;
  modal: Modal;
  toast: (message: string, error?: boolean) => void;
};
export const CrmContext = createContext<CrmContextValue | null>(null);
export function useCrm() {
  const value = useContext(CrmContext);
  if (!value) throw new Error("CRM provider is required");
  return value;
}
