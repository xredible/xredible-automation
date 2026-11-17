"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BadgeIndianRupee,
  ChevronDown,
  CircleUserRound,
  Home,
  Layers,
  LogOut,
  KeyRound,
  Palette,
  Settings2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  ADMIN_VIEWS,
  BUSINESSES,
  hubOf,
  hubsOf,
  type BusinessKey,
  type HubKey,
  type ViewName,
} from "@/lib/dashboard/businesses";
import { PLATFORM } from "./brand";
import type { Me } from "./accounts";
import { signOut } from "@/app/dashboard/actions";

const HUB_ICON = {
  home: Home,
  content: Layers,
  results: TrendingUp,
  automations: Settings2,
  brand: Palette,
};
const labelOf = (biz: BusinessKey, view: ViewName) =>
  view === "automations" ? "All automations" : view === "overview"
    ? "Home"
    : BUSINESSES[biz].labels?.[view] || PLATFORM[view]?.label || view;
function HubIcon({ hub }: { hub: HubKey }) {
  const Icon = HUB_ICON[hub];
  return <Icon className="h-5 w-5 shrink-0" aria-hidden />;
}

export function HubSidebar({
  biz,
  view,
  admin,
  go,
}: {
  biz: BusinessKey;
  view: ViewName;
  admin: boolean;
  go: (v: ViewName) => void;
}) {
  const active = hubOf(biz, view);
  return (
    <aside
      className="dash-sidebar hidden lg:flex"
      aria-label="Dashboard navigation"
    >
      <div className="dash-sidebar-brand" aria-hidden />
      <div className="dash-sidebar-caption">Your workspace</div>
      <nav
        className="dash-shell-nav min-h-0 flex-1 overflow-y-auto"
        aria-label="Workspace hubs"
      >
        {hubsOf(biz).map((h) => (
          <div className="dash-hub-group" key={h.key}>
            <button
              type="button"
              className="dash-hub-button"
              disabled={!h.items.length}
              aria-current={active.key === h.key ? "true" : undefined}
              aria-expanded={
                h.key !== "home" && h.items.length
                  ? active.key === h.key
                  : undefined
              }
              aria-controls={
                h.key !== "home" && h.items.length
                  ? `hub-pages-${h.key}`
                  : undefined
              }
              onClick={() => {
                if (h.key !== active.key) go(h.items[0]);
              }}
              title={
                !h.items.length ? "No pages assigned to this hub" : undefined
              }
            >
              <HubIcon hub={h.key} />
              <span>{h.label}</span>
              {h.key !== "home" && h.items.length ? (
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${active.key === h.key ? "rotate-180" : ""}`}
                  aria-hidden
                />
              ) : null}
            </button>
            {h.key !== "home" && h.items.length && active.key === h.key ? (
              <ul id={`hub-pages-${h.key}`} className="dash-hub-pages">
                {h.items.map((v) => (
                  <li key={v}>
                    <button
                      type="button"
                      className="dash-subpage"
                      aria-current={v === view ? "page" : undefined}
                      onClick={() => go(v)}
                    >
                      {labelOf(biz, v)}
                    </button>
                  </li>
                ))}
                {admin && ADMIN_VIEWS.includes(view) && h.key === "brand" ? (
                  <li>
                    <span className="dash-subpage" aria-current="page">
                      {labelOf(biz, view)}
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ))}
      </nav>
      <div className="dash-sidebar-footer">
        <span className="dash-status-dot" aria-hidden />
        Review first. Publish with approval.
      </div>
    </aside>
  );
}

export function HubSubnav({
  biz,
  view,
  go,
}: {
  biz: BusinessKey;
  view: ViewName;
  go: (v: ViewName) => void;
}) {
  const active = hubOf(biz, view);
  const strip = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active.key !== "results") return;
    const reveal = () => {
      const nav = strip.current;
      const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !selected || nav.scrollWidth <= nav.clientWidth) return;
      const bar = nav.getBoundingClientRect(), chip = selected.getBoundingClientRect();
      if (chip.left < bar.left || chip.right > bar.right) nav.scrollLeft += chip.left - bar.left - (bar.width - chip.width) / 2;
    };
    reveal();
    window.addEventListener("resize", reveal);
    return () => window.removeEventListener("resize", reveal);
  }, [biz, view, active.key]);
  if (active.items.length < 2) return null;
  return (
    <nav
      ref={strip}
      className={`dash-mobile-subnav ${active.key === "content" ? "dash-content-tabs" : active.key === "results" ? "dash-results-chips" : "lg:hidden"}`}
      aria-label={active.key === "results" ? "Results channels" : `${active.label} pages`}
    >
      {active.items.map((v) => (
        <button
          key={v}
          type="button"
          aria-current={v === view ? "page" : undefined}
          onClick={() => go(v)}
        >
          {active.key === "results" ? ({ga4:"Website",sessions:"Traffic",gsc:"Search",email:"Email",adsense:"Ad earnings",ads:"Ads"} as Partial<Record<ViewName,string>>)[v] || labelOf(biz,v) : active.key === "content" && v === "schedule" ? "Calendar" : active.key === "content" && v === "blog" ? "Blog posts" : labelOf(biz, v)}
        </button>
      ))}
    </nav>
  );
}
export function MobileHubBar({
  biz,
  view,
  go,
}: {
  biz: BusinessKey;
  view: ViewName;
  go: (v: ViewName) => void;
}) {
  const active = hubOf(biz, view);
  return (
    <nav className="dash-bottom-tabs lg:hidden" aria-label="Workspace tabs">
      {hubsOf(biz).map((h) => (
        <button
          key={h.key}
          type="button"
          disabled={!h.items.length}
          aria-current={active.key === h.key ? "true" : undefined}
          onClick={() => {
            if (active.key !== h.key) go(h.items[0]);
          }}
          title={!h.items.length ? "No pages assigned to this hub" : undefined}
        >
          <HubIcon hub={h.key} />
          <span>{h.phoneLabel}</span>
        </button>
      ))}
    </nav>
  );
}

export function AvatarMenu({
  me,
  allowed,
  onAccounts,
  onCustomers,
  onPassword,
  onPage,
}: {
  me: Me;
  allowed: BusinessKey[];
  onAccounts: () => void;
  onCustomers: () => void;
  onPassword: () => void;
  onPage: (v: ViewName) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <div className="dash-avatar-wrap" ref={box}>
      <button
        ref={trigger}
        type="button"
        className="dash-avatar-trigger"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dash-avatar-initial" aria-hidden>
          {(me.name || me.email).slice(0, 1).toUpperCase()}
        </span>
        <ChevronDown className="hidden h-4 w-4 sm:block" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="dash-account-menu"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
          }}
        >
          <div className="dash-account-identity">
            <CircleUserRound className="h-5 w-5 shrink-0" aria-hidden />
            <div>
              <strong>{me.name || me.email}</strong>
              <span>{me.role === "admin" ? "Admin" : me.email}</span>
            </div>
            <button
              type="button"
              aria-label="Close account menu"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {me.role === "admin" ? (
            <>
              <button type="button" onClick={() => choose(onAccounts)}>
                <Users className="h-4 w-4" aria-hidden />
                Accounts
              </button>
              <button type="button" onClick={() => choose(onCustomers)}>
                <BadgeIndianRupee className="h-4 w-4" aria-hidden />
                Customers
              </button>
            </>
          ) : null}
          {allowed.includes("autopilot") ? (
            <button
              type="button"
              onClick={() => choose(() => onPage("billing"))}
            >
              <BadgeIndianRupee className="h-4 w-4" aria-hidden />
              Billing
            </button>
          ) : null}
          <button type="button" onClick={() => choose(onPassword)}>
            <KeyRound className="h-4 w-4" aria-hidden />
            My password
          </button>
          {me.role === "admin" && allowed.includes("autopilot") ? (
            <details className="dash-admin-menu">
              <summary>Admin pages</summary>
              {ADMIN_VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => choose(() => onPage(v))}
                >
                  {PLATFORM[v].label}
                </button>
              ))}
            </details>
          ) : null}
          <form action={signOut}>
            <button type="submit">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
