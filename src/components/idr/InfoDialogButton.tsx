"use client";

import { useRef, type ReactNode } from "react";

export function InfoDialogButton({ label, children }: { label: string; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-xl border border-idr-border bg-idr-card p-5 max-w-lg w-[90vw] text-idr-text-muted [&::backdrop]:bg-black/60"
      >
        <div className="text-xs sm:text-sm leading-relaxed space-y-3">{children}</div>

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="mt-4 rounded-full border border-idr-border px-4 py-2 text-sm"
        >
          Fechar
        </button>
      </dialog>
    </div>
  );
}
