"use client";
import { useState, useSyncExternalStore, useEffect } from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";
import { ZodError } from "zod";
import { CrmContext } from "./context";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  dispatch,
  storageWarning,
} from "./store";
import type { Command, Modal } from "./types";
import { CrmDialogs } from "@/components/crm/dialogs";
export function CrmProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [modal, open] = useState<Modal>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const toast = (message: string, error = false) =>
    setNotice({ message, error });
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  function run(command: Command, message = "Perubahan berhasil disimpan.") {
    try {
      dispatch(command);
      toast(message);
      return true;
    } catch (error) {
      toast(
        error instanceof ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : "Perubahan gagal disimpan.",
        true,
      );
      return false;
    }
  }
  return (
    <CrmContext.Provider value={{ state, run, open, modal, toast }}>
      {children}
      {storageWarning() && (
        <div className="storage-warning" role="alert">
          {storageWarning()}
        </div>
      )}
      <CrmDialogs />
      {notice && (
        <div
          className={`toast ${notice.error ? "toast-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <CircleAlert size={19} /> : <CircleCheck size={19} />}
          <span>{notice.message}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </CrmContext.Provider>
  );
}
