"use client";

/**
 * Agent-facing tool definitions.
 *
 * These tools are executed CLIENT-side (they manipulate the sandbox-store
 * and route the user). Both the voice agent (Realtime API, via the data
 * channel `session.update`) and the text agent (ChatKit's `clientTools`)
 * speak to them.
 *
 * The two surfaces want slightly different shapes:
 *   • Realtime API tools: { type: "function", name, description, parameters }
 *   • ChatKit clientTools: { description, parameters, handler(args) }
 * so we keep the schema in one place and adapt at the call sites.
 */

import { pushClientActivity } from "./activity-store";
import {
  addWidget,
  clearSandbox,
  deleteDashboard,
  duplicateDashboard,
  getSandbox,
  newDashboard,
  removeWidget,
  renameDashboard,
  replaceSandbox,
  setActiveDashboard,
  setFilters,
  setSandboxMeta,
  updateWidget,
  type Widget,
  type WidgetInput,
  type WidgetKind,
} from "./sandbox-store";
import { appendCanvas, updateCanvas } from "./studio-state";

const ROUTES = ["/", "/sandbox", "/studio"] as const;
type Route = (typeof ROUTES)[number];

const WIDGET_KINDS: WidgetKind[] = [
  "kpi", "trend", "gauge", "sparkline", "heatmap", "compare", "products", "trials", "note",
];

/** JSON-Schema fragment for a Widget. Used by both Realtime + ChatKit. */
const WIDGET_SCHEMA = {
  type: "object",
  required: ["kind"],
  properties: {
    kind: { type: "string", enum: WIDGET_KINDS },
    title: { type: "string", description: "Optional widget title shown in the header." },
    kpiName: {
      type: "string",
      description:
        "For kind in {kpi, trend, gauge, sparkline}. One of the KPI names from the operations dashboard, e.g. 'Net product revenue (Zenoxitam)' or 'Batch right-first-time'.",
    },
    variant: {
      type: "string",
      enum: ["area", "line"],
      description:
        "For kind=trend. 'area' is the default filled-area chart; 'line' renders the same series as a line-only chart (no fill). Use 'line' when the user asks for a line chart or wants to suppress the fill.",
    },
    kpiNames: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
      description:
        "For kind=compare. 2-4 KPI names to display side-by-side with sized bars and target tick marks.",
    },
    period: {
      type: "string",
      description: "For kind in {kpi, gauge, compare}. Period like '2026-Q1'. Defaults to '2026-Q1'.",
    },
    function_: {
      type: "string",
      description:
        "For kind=heatmap. Optional filter to a single function (Clinical Operations, Manufacturing, Pharmacovigilance, Commercial, R&D). Omit to show all.",
    },
    therapyArea: {
      type: "string",
      description:
        "For kind=products. Filter by therapy area: Cardiology, Neurology, Oncology, Immunology, Metabolic, Rare disease.",
    },
    productName: {
      type: "string",
      description: "For kind=trials. Filter trials to a specific product name.",
    },
    phase: { type: "string", description: "For kind=trials. e.g. III, IV." },
    status: {
      type: "string",
      description: "For kind=trials. e.g. Recruiting, Active, Completed.",
    },
    markdown: {
      type: "string",
      description: "For kind=note. A short Markdown blurb / headline.",
    },
    pos: {
      type: "object",
      description:
        "Optional grid position { x, y, w, h } in cells (canvas is 12 cols wide). If omitted, the widget is auto-placed in the next free row at the default size.",
      properties: {
        x: { type: "integer", minimum: 0, maximum: 11 },
        y: { type: "integer", minimum: 0 },
        w: { type: "integer", minimum: 2, maximum: 12 },
        h: { type: "integer", minimum: 2 },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Tool definitions, keyed by name.
// ---------------------------------------------------------------------------

export type AgentTool = {
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: { router: AgentRouter }) => Promise<unknown> | unknown;
};

export type AgentRouter = { push: (path: string) => void };

export function buildAgentTools(): Record<string, AgentTool> {
  return {
    navigate: {
      description:
        "Navigate the user to a route. Use '/sandbox' before building or editing a custom dashboard. Use '/' to return to the operations snapshot.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", enum: [...ROUTES] },
        },
      },
      handler: async ({ path }, { router }) => {
        const p = String(path);
        if (!ROUTES.includes(p as Route)) return { ok: false, error: `unknown path ${p}` };
        router.push(p);
        return { ok: true, path: p };
      },
    },

    create_dashboard: {
      description:
        "Replace the sandbox dashboard wholesale. Use this when the user asks for a new dashboard about a topic — gather a title and 2-5 widgets that cover the topic.",
      parameters: {
        type: "object",
        required: ["title", "widgets"],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          widgets: { type: "array", items: WIDGET_SCHEMA, minItems: 1, maxItems: 8 },
        },
      },
      handler: async (args, { router }) => {
        const next = replaceSandbox({
          title: String(args.title ?? "Untitled dashboard"),
          subtitle: typeof args.subtitle === "string" ? args.subtitle : undefined,
          widgets: (args.widgets as WidgetInput[]) ?? [],
        });
        router.push("/sandbox");
        return { ok: true, widgetCount: next.widgets.length };
      },
    },

    add_widget: {
      description: "Append one widget to the current sandbox dashboard.",
      parameters: WIDGET_SCHEMA,
      handler: async (args, { router }) => {
        const w = addWidget(args as WidgetInput);
        router.push("/sandbox");
        return { ok: true, id: w.id };
      },
    },

    remove_widget: {
      description: "Remove one widget by id.",
      parameters: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      handler: async ({ id }) => {
        removeWidget(String(id));
        return { ok: true };
      },
    },

    update_widget: {
      description: "Patch an existing widget's fields by id.",
      parameters: {
        type: "object",
        required: ["id", "patch"],
        properties: {
          id: { type: "string" },
          patch: WIDGET_SCHEMA,
        },
      },
      handler: async ({ id, patch }) => {
        updateWidget(String(id), patch as Partial<Widget>);
        return { ok: true };
      },
    },

    set_dashboard_meta: {
      description: "Update the sandbox title and/or subtitle without touching widgets.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
        },
      },
      handler: async ({ title, subtitle }) => {
        setSandboxMeta({
          title: typeof title === "string" ? title : undefined,
          subtitle: typeof subtitle === "string" ? subtitle : undefined,
        });
        return { ok: true };
      },
    },

    clear_dashboard: {
      description: "Wipe the current sandbox dashboard back to empty (keeps it in the list).",
      parameters: { type: "object", properties: {} },
      handler: async () => {
        clearSandbox();
        return { ok: true };
      },
    },

    set_filters: {
      description:
        "Set global filters on the active sandbox dashboard. Period, therapy area, and function are inherited by every widget that doesn't specify its own. Pass null/empty string to clear an individual filter.",
      parameters: {
        type: "object",
        properties: {
          period:      { type: "string", description: "e.g. '2026-Q1'. Empty to clear." },
          therapyArea: { type: "string", description: "e.g. 'Cardiology'. Empty to clear." },
          function:    { type: "string", description: "e.g. 'Commercial'. Empty to clear." },
        },
      },
      handler: async ({ period, therapyArea, function: fn }) => {
        setFilters({
          period: typeof period === "string" ? (period || undefined) : undefined,
          therapyArea: typeof therapyArea === "string" ? (therapyArea || undefined) : undefined,
          function: typeof fn === "string" ? (fn || undefined) : undefined,
        });
        return { ok: true };
      },
    },

    new_dashboard: {
      description: "Create a brand-new empty dashboard and switch to it.",
      parameters: {
        type: "object",
        required: ["title"],
        properties: {
          title:    { type: "string" },
          subtitle: { type: "string" },
        },
      },
      handler: async ({ title, subtitle }, { router }) => {
        const d = newDashboard(String(title ?? "Untitled"), typeof subtitle === "string" ? subtitle : undefined);
        router.push("/sandbox");
        return { ok: true, id: d.id };
      },
    },

    switch_dashboard: {
      description:
        "Switch the active sandbox dashboard by id or by title (case-insensitive substring match).",
      parameters: {
        type: "object",
        properties: {
          id:    { type: "string" },
          title: { type: "string" },
        },
      },
      handler: async ({ id, title }, { router }) => {
        const s = getSandbox();
        let targetId: string | undefined = typeof id === "string" ? id : undefined;
        if (!targetId && typeof title === "string") {
          const t = title.toLowerCase();
          targetId = s.order.find((dId) => s.dashboards[dId]?.title.toLowerCase().includes(t));
        }
        if (!targetId || !s.dashboards[targetId]) return { ok: false, error: "dashboard not found" };
        setActiveDashboard(targetId);
        router.push("/sandbox");
        return { ok: true, id: targetId };
      },
    },

    rename_dashboard: {
      description: "Rename a dashboard by id (defaults to the active one).",
      parameters: {
        type: "object",
        required: ["title"],
        properties: {
          id:       { type: "string" },
          title:    { type: "string" },
          subtitle: { type: "string" },
        },
      },
      handler: async ({ id, title, subtitle }) => {
        const dashId = (typeof id === "string" && id) || getSandbox().activeId;
        renameDashboard(dashId, String(title), typeof subtitle === "string" ? subtitle : undefined);
        return { ok: true, id: dashId };
      },
    },

    duplicate_dashboard: {
      description: "Duplicate a dashboard by id (defaults to the active one) and switch to the copy.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
      },
      handler: async ({ id }) => {
        const dashId = (typeof id === "string" && id) || getSandbox().activeId;
        const copy = duplicateDashboard(dashId);
        return { ok: !!copy, id: copy?.id };
      },
    },

    delete_dashboard: {
      description: "Delete a dashboard by id (defaults to the active one). If it was the last one, a fresh empty dashboard is created.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
      },
      handler: async ({ id }) => {
        const dashId = (typeof id === "string" && id) || getSandbox().activeId;
        deleteDashboard(dashId);
        return { ok: true };
      },
    },

    update_canvas: {
      description:
        "Replace the Studio canvas with open-ended content authored by the agent — markdown text plus embedded charts. Use whenever the user wants a richer answer in the side canvas: explanations alongside charts, a tear-sheet, a written analysis, a draft document. Embedded charts use a fenced code block with the language tag `altigen-chart` whose body is a JSON widget spec.",
      parameters: {
        type: "object",
        required: ["content"],
        properties: {
          title:   { type: "string", description: "Optional canvas title shown in the header." },
          content: { type: "string", description: "Markdown body. May embed live charts via ```altigen-chart\\n{...}\\n``` fences (one JSON object per fence)." },
        },
      },
      handler: async (args, { router }) => {
        const title = typeof args.title === "string" ? args.title : undefined;
        const content = typeof args.content === "string" ? args.content : "";
        updateCanvas({ title: title ?? null, content });
        router.push("/studio");
        return { ok: true, length: content.length };
      },
    },

    append_canvas: {
      description:
        "Append additional markdown content to the existing Studio canvas (keeps prior content). Useful for layering follow-ups onto the current canvas without rewriting it.",
      parameters: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", description: "Markdown to append. May include ```altigen-chart``` fences." },
        },
      },
      handler: async ({ content }, { router }) => {
        appendCanvas(typeof content === "string" ? content : "");
        router.push("/studio");
        return { ok: true };
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/** Realtime API tool definitions for `session.update`. */
export function toolsForRealtime(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  const tools = buildAgentTools();
  return Object.entries(tools).map(([name, t]) => ({
    type: "function",
    name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** Execute a tool by name with raw JSON args. */
export async function executeTool(
  name: string,
  rawArgs: string | Record<string, unknown>,
  ctx: { router: AgentRouter },
): Promise<{ ok: boolean; output: string }> {
  const tools = buildAgentTools();
  const tool = tools[name];
  if (!tool) return { ok: false, output: JSON.stringify({ ok: false, error: `unknown tool ${name}` }) };
  let args: Record<string, unknown> = {};
  if (typeof rawArgs === "string") {
    try {
      args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    } catch {
      return { ok: false, output: JSON.stringify({ ok: false, error: "args were not valid JSON" }) };
    }
  } else {
    args = rawArgs ?? {};
  }
  pushClientActivity({ kind: "client_tool", name, arguments: args });
  try {
    const result = await tool.handler(args, ctx);
    pushClientActivity({ kind: "tool_result", name, result });
    return { ok: true, output: JSON.stringify(result ?? { ok: true }) };
  } catch (err) {
    pushClientActivity({ kind: "tool_result", name, result: { error: String(err) } });
    return { ok: false, output: JSON.stringify({ ok: false, error: String(err) }) };
  }
}
