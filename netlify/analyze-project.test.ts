import { describe, expect, it } from "vitest";

import handleDefault, {
  handleAnalyzeRequest,
  type AnalysisProvider,
  type HandlerDeps,
} from "./functions/analyze-project/index";

function validRequestBody() {
  return {
    schemaVersion: 1,
    requestId: "request-1",
    locale: "en",
    outputLanguage: "en",
    consent: { accepted: true, acceptedAt: "2026-08-15T00:00:00.000Z", noticeVersion: "phase-1-preview" },
    project: {
      idea: "A bounded project idea",
      problem: "A bounded problem",
      targetUsers: ["Developers"],
      selectedDomainIds: ["domain-web"],
      targetPlatforms: ["web"],
      experienceProfile: "intermediate",
      scale: "mvp",
      knownRequirements: [],
    },
    catalogContext: { catalogVersion: "v1", allowedItemIds: ["language-typescript"] },
  };
}

function validProviderOutput() {
  return {
    classification: { domainIds: ["domain-web"], complexity: "standard", confidence: 0.8 },
    clarificationQuestions: [],
    proposedRequirements: [],
    recommendedItemIds: ["language-typescript"],
    customProposals: [],
    risks: [],
    testNeeds: [],
    documentNeeds: [],
    warnings: [],
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/.netlify/functions/analyze-project", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function baseDeps(provider: AnalysisProvider | undefined): HandlerDeps {
  return {
    provider,
    allowedOrigin: undefined,
    now: () => 0,
    generateId: () => "generated-id",
  };
}

describe("handleAnalyzeRequest — real handler with an injected fake provider (FR-030–036)", () => {
  it("returns 200 with a schema-valid result on a successful provider call", async () => {
    const fakeProvider: AnalysisProvider = { createAnalysis: async () => validProviderOutput() };
    const response = await handleAnalyzeRequest(postRequest(validRequestBody()), baseDeps(fakeProvider));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.requestId).toBe("request-1");
    expect(body.analysisId).toBe("generated-id");
    expect(body.recommendedItemIds).toEqual(["language-typescript"]);
  });

  it("returns AI_TIMEOUT/504 when the provider call aborts", async () => {
    const fakeProvider: AnalysisProvider = {
      createAnalysis: async () => {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
    };
    const response = await handleAnalyzeRequest(postRequest(validRequestBody()), baseDeps(fakeProvider));
    expect(response.status).toBe(504);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AI_TIMEOUT");
  });

  it("returns AI_PROVIDER_ERROR/502 when the provider call fails", async () => {
    const fakeProvider: AnalysisProvider = {
      createAnalysis: async () => {
        throw new Error("provider unavailable");
      },
    };
    const response = await handleAnalyzeRequest(postRequest(validRequestBody()), baseDeps(fakeProvider));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AI_PROVIDER_ERROR");
  });

  it("returns AI_INVALID_OUTPUT/502 when the provider returns a malformed result", async () => {
    const fakeProvider: AnalysisProvider = { createAnalysis: async () => ({ nonsense: true }) };
    const response = await handleAnalyzeRequest(postRequest(validRequestBody()), baseDeps(fakeProvider));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AI_INVALID_OUTPUT");
  });

  it("returns AI_DISABLED/503 when no provider is configured, without calling anything", async () => {
    const response = await handleAnalyzeRequest(postRequest(validRequestBody()), baseDeps(undefined));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AI_DISABLED");
  });

  it("returns ORIGIN_NOT_ALLOWED/403 for a disallowed origin, before calling the provider", async () => {
    let called = false;
    const fakeProvider: AnalysisProvider = {
      createAnalysis: async () => {
        called = true;
        return validProviderOutput();
      },
    };
    const deps: HandlerDeps = { ...baseDeps(fakeProvider), allowedOrigin: "https://allowed.example" };
    const response = await handleAnalyzeRequest(
      postRequest(validRequestBody(), { origin: "https://not-allowed.example" }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });

  it("returns PAYLOAD_TOO_LARGE/413 for an oversized body, before parsing JSON", async () => {
    const oversized = "x".repeat(40_000);
    const response = await handleAnalyzeRequest(postRequest(oversized), baseDeps(undefined));
    expect(response.status).toBe(413);
  });

  it("returns INVALID_REQUEST/400 for a non-JSON body", async () => {
    const response = await handleAnalyzeRequest(postRequest("not json"), baseDeps(undefined));
    expect(response.status).toBe(400);
  });

  it("returns 405 for a non-POST method", async () => {
    const request = new Request("https://example.com/.netlify/functions/analyze-project", { method: "GET" });
    const response = await handleAnalyzeRequest(request, baseDeps(undefined));
    expect(response.status).toBe(405);
  });
});

describe("default handler wiring", () => {
  it("resolves to AI_DISABLED when ANTHROPIC_API_KEY/ANTHROPIC_MODEL are unset (never calls a real provider)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    const response = await handleDefault(postRequest(validRequestBody()));
    expect(response.status).toBe(503);
  });
});
