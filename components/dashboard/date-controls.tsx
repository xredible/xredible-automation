"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { addDays, daysBetween, rangeLabel, todayIST } from "./format";
import {
  COMPARE,
  PRESETS,
  presetDates,
  type Cmp,
  type DashState,
  type Preset,
} from "./state";
export function ResultsDateControls({
  state,
  onChange,
}: {
  state: DashState;
  onChange: (patch: Partial<DashState>) => void;
}) {
  return (
    <div
      className="dash-results-controls"
      role="group"
      aria-label="Report dates"
    >
      <RangePicker state={state} onChange={onChange} />
      <div className="relative">
        <label className="sr-only" htmlFor="cmp-results">Compare with</label>
        <select
          id="cmp-results"
          value={state.cmp}
          onChange={(e) => onChange({ cmp: e.target.value as Cmp })}
          className="appearance-none rounded-lg border border-[var(--line)] bg-[var(--panel)] pl-3 pr-7 text-xs font-medium text-[var(--ink-2)]"
        >
          {COMPARE.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]"
        />
      </div>
    </div>
  );
}
export function RangePicker({
  state,
  onChange,
}: {
  state: DashState;
  onChange: (p: Partial<DashState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const datesKey = `${state.start}:${state.end}`;
  const [draft, setDraft] = useState({
    key: datesKey,
    from: state.start,
    to: state.end,
  });
  const from = draft.key === datesKey ? draft.from : state.start;
  const to = draft.key === datesKey ? draft.to : state.end;
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const today = todayIST();
  const pick = (p: Preset) => {
    if (p === "custom") return;
    onChange({ preset: p, ...presetDates(p) });
    setOpen(false);
    trigger.current?.focus();
  };
  const valid =
    from && to && from <= to && to <= today && daysBetween(from, to) <= 729;
  const label = useMemo(
    () => PRESETS.find((p) => p.id === state.preset)?.label,
    [state.preset],
  );
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        ref={trigger}
        aria-label={`Date range: ${rangeLabel(state.start, state.end)}`}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-xs font-medium text-[var(--ink)] hover:border-[var(--line-strong)]"
      >
        <CalendarRange className="h-3.5 w-3.5 text-[var(--muted)]" />
        <span className="hidden sm:inline">
          {state.preset === "custom" ? "Custom" : label}
        </span>
        <span className="text-[var(--muted)] sm:border-l sm:border-[var(--line)] sm:pl-2">
          {rangeLabel(state.start, state.end)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--faint)]" />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose date range"
          className="absolute left-0 top-full mt-2 sm:left-auto sm:right-0 z-40 w-[min(92vw,320px)] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl"
        >
          <ul className="grid grid-cols-2 gap-1">
            {PRESETS.filter((p) => p.id !== "custom").map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium ${state.preset === p.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--ink-2)] hover:bg-[var(--chip)]"}`}
                >
                  {p.label}
                  {state.preset === p.id ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-[var(--line)] px-1 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--faint)]">
              Custom dates
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-[var(--muted)]">
                From
                <input
                  id="range-from"
                  type="date"
                  value={from}
                  max={to || today}
                  min={addDays(today, -729)}
                  onChange={(e) =>
                    setDraft({ key: datesKey, from: e.target.value, to })
                  }
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--ink)]"
                />
              </label>
              <label className="text-[11px] text-[var(--muted)]">
                To
                <input
                  id="range-to"
                  type="date"
                  value={to}
                  max={today}
                  min={from}
                  onChange={(e) =>
                    setDraft({ key: datesKey, from, to: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--ink)]"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                onChange({ preset: "custom", start: from, end: to });
                setOpen(false);
                trigger.current?.focus();
              }}
              className="mt-2 w-full rounded-lg bg-[var(--brand)] py-2 text-xs font-semibold text-white disabled:opacity-40 dark:text-[var(--nav)]"
            >
              Apply {valid ? `· ${daysBetween(from, to) + 1} days` : ""}
            </button>
            <p className="!m-0 mt-2 !text-[11px] leading-snug text-[var(--faint)]">
              Up to 2 years. Pinterest only keeps the last 90 days.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
