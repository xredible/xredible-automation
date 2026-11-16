"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  BUSINESSES,
  type BusinessKey,
  type ViewName,
} from "@/lib/dashboard/businesses";
import {
  filterJumps,
  jumpEntries,
  type JumpEntry,
} from "@/lib/dashboard/search-jump";
import { PLATFORM } from "./brand";
type ExportEntry = JumpEntry & { download?: HTMLButtonElement };
const pageLabel = (biz: BusinessKey, v: ViewName) =>
  v === "overview"
    ? "Home"
    : BUSINESSES[biz].labels?.[v] || PLATFORM[v]?.label || v;
export function SearchJump({
  biz,
  view,
  admin,
  hasAutopilot,
  enabled,
  onPick,
}: {
  biz: BusinessKey;
  view: ViewName;
  admin: boolean;
  hasAutopilot: boolean;
  enabled: boolean;
  onPick: (entry: JumpEntry) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0),
    [exports, setExports] = useState<ExportEntry[]>([]),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    opener = useRef<HTMLElement | null>(null),
    restore = useRef(true),
    scroll = useRef({ x: 0, y: 0 });
  const id = useId(),
    listId = `${id}-results`,
    titleId = `${id}-title`;
  const entries = useMemo(
    () => jumpEntries(biz, admin, hasAutopilot, pageLabel),
    [biz, admin, hasAutopilot],
  );
  const results = filterJumps([...entries, ...exports], query) as ExportEntry[];
  const active = Math.max(
    0,
    Math.min(selected, Math.max(0, results.length - 1)),
  );
  const optionId = (i: number) => `${id}-option-${i}`;
  const close = useCallback((returnFocus = true) => {
    restore.current = returnFocus;
    if (dialog.current?.open) dialog.current.close();
    setOpen(false);
    setQuery("");
    setSelected(0);
    setExports([]);
  }, []);
  const show = useCallback(() => {
    if (!enabled || document.querySelector('dialog[open], [role="dialog"]'))
      return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    scroll.current = { x: scrollX, y: scrollY };
    restore.current = true;
    setExports(
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          "main button[data-dashboard-export]",
        ),
      ]
        .filter(
          (b) =>
            !b.disabled &&
            b.getClientRects().length > 0 &&
            getComputedStyle(b).visibility !== "hidden",
        )
        .map((button, i) => ({
          id: `export:${i}`,
          label: `Download CSV: ${button.dataset.dashboardExport}`,
          description: `${pageLabel(biz, view)} · Current report data`,
          keywords: `csv export spreadsheet download ${pageLabel(biz, view)}`,
          kind: "Action",
          download: button,
        })),
    );
    setQuery("");
    setSelected(0);
    setError("");
    setOpen(true);
  }, [enabled, biz, view]);
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLocaleLowerCase() === "k" &&
        !e.isComposing
      ) {
        e.preventDefault();
        if (e.repeat) return;
        if (open) close();
        else show();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [enabled, open, close, show]);
  useEffect(() => {
    if (!open) return;
    const d = dialog.current;
    if (!d) return;
    const fallbackTrigger = trigger.current;
    d.showModal();
    input.current?.focus();
    const resize = () => {
      d.style.setProperty(
        "--dash-search-height",
        `${window.visualViewport?.height || innerHeight}px`,
      );
      d.style.setProperty(
        "--dash-search-offset",
        `${window.visualViewport?.offsetTop || 0}px`,
      );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      if (d.open) d.close();
      if (restore.current) {
        const prior = opener.current;
        (prior?.isConnected && prior !== document.body
          ? prior
          : fallbackTrigger
        )?.focus({ preventScroll: true });
        window.scrollTo({
          left: scroll.current.x,
          top: scroll.current.y,
          behavior: "instant",
        });
      }
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, active, id, query]);
  const choose = (entry: ExportEntry) => {
    if (entry.download) {
      if (!entry.download.isConnected || entry.download.disabled) {
        setError(
          "That export is no longer available. Close search and refresh the report.",
        );
        return;
      }
      close();
      entry.download.click();
      return;
    }
    close(false);
    onPick(entry);
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="dash-search-trigger"
        disabled={!enabled}
        aria-label="Search pages and actions"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Search pages and actions (Ctrl K)"
        onClick={show}
      >
        <Search aria-hidden className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden lg:inline">Ctrl K</kbd>
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className="dash-search-dialog"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const closeButton = e.currentTarget.querySelector<HTMLButtonElement>('[aria-label="Close search"]');
            if ((!e.shiftKey && document.activeElement === input.current) || (e.shiftKey && document.activeElement === closeButton)) {
              e.preventDefault();
              (e.shiftKey ? input.current : closeButton)?.focus();
            } else if (document.activeElement !== input.current && document.activeElement !== closeButton) {
              e.preventDefault(); input.current?.focus();
            }
          }}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClick={(e) => {
            if (e.target !== dialog.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }}
        >
          <div className="dash-search-head">
            <h2 id={titleId} className="dash-card-title">
              Search {BUSINESSES[biz].name}
            </h2>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => close()}
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <div className="dash-search-field">
            <Search aria-hidden className="h-5 w-5" />
            <input
              ref={input}
              type="text"
              role="combobox"
              aria-label="Find a page or action"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                results.length ? optionId(active) : undefined
              }
              value={query}
              maxLength={120}
              placeholder="Find a page or action…"
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((i) =>
                    Math.max(0, Math.min(i + 1, results.length - 1)),
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((i) => Math.max(0, i - 1));
                } else if (e.key === "Home" && e.ctrlKey) {
                  e.preventDefault();
                  setSelected(0);
                } else if (e.key === "End" && e.ctrlKey) {
                  e.preventDefault();
                  setSelected(Math.max(0, results.length - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (results[active]) choose(results[active]);
                }
              }}
            />
          </div>
          <p className="dash-search-count" role="status">
            {error ||
              `${results.length} ${results.length === 1 ? "match" : "matches"} · Pages and actions for this workspace`}
          </p>
          <ul
            id={listId}
            className="dash-search-list"
            role="listbox"
            aria-label="Search results"
          >
            {results.map((entry, i) => (
              <li key={entry.id} role="none">
                <button
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  aria-label={entry.label}
                  tabIndex={-1}
                  className="dash-search-option"
                  onPointerMove={() => setSelected(i)}
                  onClick={() => choose(entry)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="dash-search-label">{entry.label}</span>
                    <span className="dash-search-description">
                      {entry.description}
                    </span>
                  </span>
                  <span className="dash-search-kind">{entry.kind}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          {!results.length ? (
            <p className="dash-search-empty">
              No matches in {BUSINESSES[biz].name}. Try a page name such as
              Ideas or Settings.
            </p>
          ) : null}
          <div className="dash-search-footer">
            Arrow keys to move · Enter to open · Escape to close
          </div>
        </dialog>
      ) : null}
    </>
  );
}
