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
  removeWidget,
  replaceSandbox,
  setSandboxMeta,
  updateWidget,
  type Widget,
  type WidgetInput,
  type WidgetKind,
} from "./sandbox-store";

const ROUTES = ["/", "/sandbox"] as const;
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
      description: "Wipe the sandbox dashboard back to empty.",
      parameters: { type: "object", properties: {} },
      handler: async () => {
        clearSandbox();
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
