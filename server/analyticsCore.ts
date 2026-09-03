import { invokeLLM } from "./_core/llm";
import { saveAdvancedAnalyticsRun } from "./db";

export const ADVANCED_ANALYTICS_MODULES = [
  "formations", "presnap", "turnovers", "heatMaps", "routeTree", "blocking",
  "momentum", "gaps", "injury", "penalties", "redZone", "thirdDown",
  "twoMinute", "situational", "playerComparisons",
] as const;

export type AdvancedAnalyticsModule = (typeof ADVANCED_ANALYTICS_MODULES)[number];

type ReportLike = {
  highlights?: unknown;
  executiveSummary?: unknown;
  offensiveTendencies?: unknown;
  defensiveTendencies?: unknown;
  keyPersonnel?: unknown;
  recommendations?: unknown;
};

export type AnalyticsEvidence = {
  highlightIndex: number;
  startSeconds: number;
  endSeconds: number;
  description: string;
};

export type AnalyticsQuality = {
  status: "ready" | "insufficient";
  summary: string;
  confidence: number;
  dataBasis: string;
  evidence: AnalyticsEvidence[];
  missingInputs: string[];
  limitations: string[];
};

export type GuardedAnalyticsResult = Record<string, unknown> & { _quality: AnalyticsQuality };

const envelopeSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ready", "insufficient"] },
    summary: { type: "string" },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          highlightIndex: { type: "integer" },
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          description: { type: "string" },
        },
        required: ["highlightIndex", "startSeconds", "endSeconds", "description"],
        additionalProperties: false,
      },
    },
    missingInputs: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    analysisJson: { type: "string" },
  },
  required: ["status", "summary", "confidence", "evidence", "missingInputs", "limitations", "analysisJson"],
  additionalProperties: false,
} as const;

function asText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return content ? JSON.stringify(content) : "";
}

function parseObject(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Analytics model did not return a JSON object");
  return parsed as Record<string, unknown>;
}

function getHighlights(report: ReportLike) {
  return Array.isArray(report.highlights) ? report.highlights : [];
}

export async function runGuardedAnalytics(args: {
  module: AdvancedAnalyticsModule;
  report: ReportLike;
  instructions: string;
  requiredExternalInputs?: string[];
  verifiedContext?: string;
}): Promise<GuardedAnalyticsResult> {
  const highlights = getHighlights(args.report);
  const context = args.verifiedContext?.trim() ?? "";
  const dataBasis = `AI estimate from ${highlights.length} scouting-report highlight${highlights.length === 1 ? "" : "s"}${context ? " plus coach-supplied context" : ""}; not optical player tracking or official statistics`;

  if (highlights.length === 0 && !context) {
    const quality: AnalyticsQuality = {
      status: "insufficient",
      summary: "No scouting-report highlights are available to support this analysis.",
      confidence: 0,
      dataBasis,
      evidence: [],
      missingInputs: ["At least one analyzed film highlight", ...(args.requiredExternalInputs ?? [])],
      limitations: ["No claim or percentage was generated without evidence."],
    };
    return { message: quality.summary, _quality: quality };
  }

  const response = await invokeLLM({
    model: "gemini-3-flash-preview",
    maxTokens: 4_096,
    response_format: {
      type: "json_schema",
      json_schema: { name: `advanced_${args.module}`, strict: true, schema: envelopeSchema },
    },
    messages: [{
      role: "system",
      content: `You are an evidence-first football analyst. Never invent a player identity, athletic measurement, injury status, referee tendency, historical comparison, denominator, rate, yardage, outcome, or statistic. Use only the supplied scouting-report evidence. Any examples in the requested output shape are structural examples and must never be copied. If evidence cannot support a field, use null, an empty array/object, or the string "Insufficient evidence" inside analysisJson and list the missing input. Percentages require an explicit observed numerator and denominator. status must be insufficient whenever external roster, injury, official play-by-play, referee, tracking, or verified player-measurement data is required but absent. analysisJson must itself be a valid JSON object encoded as a string.`,
    }, {
      role: "user",
      content: `MODULE: ${args.module}\n\nSCOUTING REPORT EVIDENCE:\n${JSON.stringify({
        highlights,
        executiveSummary: args.report.executiveSummary,
        offensiveTendencies: args.report.offensiveTendencies,
        defensiveTendencies: args.report.defensiveTendencies,
        keyPersonnel: args.report.keyPersonnel,
        recommendations: args.report.recommendations,
      })}\n\nCOACH-SUPPLIED VERIFIED CONTEXT:\n${context || "None supplied"}\n\nREQUIRED EXTERNAL INPUTS, IF ANY:\n${JSON.stringify(args.requiredExternalInputs ?? [])}\n\nANALYSIS REQUEST:\n${args.instructions}`,
    }],
  });

  const envelope = parseObject(asText(response.choices[0]?.message?.content));
  const payload = parseObject(String(envelope.analysisJson ?? "{}"));
  const quality: AnalyticsQuality = {
    status: envelope.status === "ready" ? "ready" : "insufficient",
    summary: String(envelope.summary ?? "Analysis generated from available evidence."),
    confidence: Math.max(0, Math.min(100, Math.round(Number(envelope.confidence) || 0))),
    dataBasis,
    evidence: Array.isArray(envelope.evidence) ? envelope.evidence as AnalyticsEvidence[] : [],
    missingInputs: Array.isArray(envelope.missingInputs) ? envelope.missingInputs.map(String) : [],
    limitations: Array.isArray(envelope.limitations) ? envelope.limitations.map(String) : [],
  };
  return { ...payload, _quality: quality };
}

export async function persistAnalyticsQuality(args: {
  sessionId: number;
  userId: number;
  module: AdvancedAnalyticsModule;
  data: GuardedAnalyticsResult;
}) {
  const quality = args.data._quality;
  await saveAdvancedAnalyticsRun({
    sessionId: args.sessionId,
    userId: args.userId,
    module: args.module,
    status: quality.status,
    summary: quality.summary,
    confidence: quality.confidence,
    dataBasis: quality.dataBasis,
    evidence: quality.evidence,
    missingInputs: quality.missingInputs,
    limitations: quality.limitations,
    coachVerified: 0,
  });
}
