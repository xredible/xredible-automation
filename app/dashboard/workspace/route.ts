import { NextResponse } from "next/server";
import { currentUser, canSee } from "@/lib/dashboard/auth";
import { isWorkspace } from "@/lib/dashboard/business-workspace";
import { workspace, workspaceAction } from "@/lib/dashboard/workspace-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  const me = await currentUser();
  if (!me) return reply({ ok: false, error: "Signed out." }, 401);
  const biz = new URL(request.url).searchParams.get("biz") || "";
  if (!isWorkspace(biz) || !(await canSee(biz)))
    return reply({ ok: false, error: "Business access denied." }, 403);
  try {
    return reply(
      await workspace(
        biz,
        new URL(request.url).searchParams.get("view") || "ap-ideas",
      ),
    );
  } catch (e) {
    return reply(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Could not load workspace.",
      },
      502,
    );
  }
}
export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return reply({ ok: false, error: "Signed out." }, 401);
  if (me.role !== "admin")
    return reply(
      {
        ok: false,
        error: "Only the owner can change this business workspace.",
      },
      403,
    );
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host)
      return reply({ ok: false, error: "Not allowed." }, 403);
  } catch {
    return reply({ ok: false, error: "Not allowed." }, 403);
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Invalid request." }, 400);
  }
  if (
    !body ||
    !isWorkspace(String(body.biz)) ||
    !(await canSee(body.biz as "nestoodle" | "elevating-christ"))
  )
    return reply({ ok: false, error: "Business access denied." }, 403);
  try {
    return reply(
      await workspaceAction(
        body.biz as "nestoodle" | "elevating-christ",
        me.email,
        body,
      ),
    );
  } catch (e) {
    return reply(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Change failed. Refresh before retrying.",
      },
      400,
    );
  }
}
