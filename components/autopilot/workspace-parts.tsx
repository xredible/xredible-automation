"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/dashboard/ui";
import { field, ghost, primary } from "./ui";

/** Common form field used by Autopilot and business workspaces. */
export function WorkspaceField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-[12.5px] font-medium text-[var(--muted)]">
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          className={field}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <input
          aria-label={label}
          className={field}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </label>
  );
}
export function HelpTopics({
  topics,
}: {
  topics: readonly (readonly [string, string])[];
}) {
  return (
    <Card title="Questions people ask">
      <div className="divide-y divide-[var(--line-soft)]">
        {topics.map(([q, a]) => (
          <details key={q} className="py-3">
            <summary className="cursor-pointer text-sm font-medium">
              {q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {a}
            </p>
          </details>
        ))}
      </div>
    </Card>
  );
}
export function ConfirmChange({
  title,
  children,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="workspace-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100vw_-_2rem)] max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 text-[var(--ink)] shadow-xl backdrop:bg-black/50"
    >
      <h2 id="workspace-confirm-title" className="text-lg font-semibold">
        {title}
      </h2>
      <div className="my-4 text-sm text-[var(--muted)]">{children}</div>
      <div className="flex justify-end gap-2">
        <button autoFocus className={ghost} disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className={primary} disabled={busy} onClick={onConfirm}>
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </dialog>
  );
}

export function IdeaComposer({
  onAdd,
  disabled,
}: {
  onAdd: (v: { title: string; keyword: string; planned: string }) => void;
  disabled: boolean;
}) {
  const [title, setTitle] = useState(""),
    [keyword, setKeyword] = useState(""),
    [planned, setPlanned] = useState("");
  return (
    <Card
      title="Add an idea"
      sub="Save a topic for review. Writing and publishing remain separate actions."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd({ title, keyword, planned });
        }}
        className="space-y-3"
      >
        <WorkspaceField
          label="Title"
          value={title}
          onChange={setTitle}
          disabled={disabled}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <WorkspaceField
            label="Keyword / theme"
            value={keyword}
            onChange={setKeyword}
            disabled={disabled}
          />
          <WorkspaceField
            label="Planned date"
            value={planned}
            onChange={setPlanned}
            type="date"
            disabled={disabled}
          />
        </div>
        <button
          className={primary}
          disabled={disabled || title.trim().length < 3}
        >
          Add idea
        </button>
      </form>
    </Card>
  );
}

export function Colour({
  name,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-[var(--muted)]">
        {name}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <input
          disabled={disabled}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1"
          aria-label={name}
        />
        <input
          disabled={disabled}
          value={value}
          onChange={(e) =>
            /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)
          }
          className={field + " mt-0 w-28 font-mono uppercase"}
          aria-label={`${name} code`}
        />
      </span>
    </label>
  );
}
