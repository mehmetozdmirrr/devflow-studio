import { describe, expect, it } from "vitest";

import {
  HTTP_STATUS_BY_CODE,
  buildErrorEnvelope,
  mapProviderOutputToResult,
  validateAnalysisRequest,
} from "./validation";

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

describe("validateAnalysisRequest (FR-030–032, AC-019/021)", () => {
  it("accepts a well-formed request", () => {
    const result = validateAnalysisRequest(validRequestBody());
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(validateAnalysisRequest("not an object")).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects an unknown top-level property", () => {
    const body = { ...validRequestBody(), extra: "field" };
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects an unsupported schemaVersion", () => {
    const body = { ...validRequestBody(), schemaVersion: 2 };
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  it("returns CONSENT_REQUIRED when consent.accepted is not true", () => {
    const body = validRequestBody();
    body.consent.accepted = false;
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "CONSENT_REQUIRED" });
  });

  it("rejects an unsupported consent notice version", () => {
    const body = validRequestBody();
    body.consent.noticeVersion = "unknown-version";
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects an oversized array field", () => {
    const body = validRequestBody();
    body.project.targetUsers = Array.from({ length: 21 }, (_, i) => `user-${i}`);
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects an invalid enum value", () => {
    const body = validRequestBody();
    (body.project as { scale: string }).scale = "not-a-scale";
    expect(validateAnalysisRequest(body)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });
});

describe("mapProviderOutputToResult (FR-032/033, AC-021)", () => {
  const allowedItemIds = ["language-typescript", "framework-react"];

  function validProviderOutput() {
    return {
      classification: { domainIds: ["domain-web"], complexity: "standard", confidence: 0.8 },
      clarificationQuestions: [],
      proposedRequirements: [],
      recommendedItemIds: ["language-typescript", "library-not-in-allowlist"],
      customProposals: [],
      risks: [],
      testNeeds: [],
      documentNeeds: [],
      warnings: [],
    };
  }

  it("accepts valid output and filters recommendedItemIds to the allowlist", () => {
    const result = mapProviderOutputToResult("req-1", "analysis-1", validProviderOutput(), allowedItemIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.recommendedItemIds).toEqual(["language-typescript"]);
  });

  it("demotes a disallowed recommended id to an unverified customProposal", () => {
    const result = mapProviderOutputToResult("req-1", "analysis-1", validProviderOutput(), allowedItemIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const demoted = result.result.customProposals.find((p) => p.name === "library-not-in-allowlist");
    expect(demoted?.verification).toBe("unverified");
  });

  it("forces verification to unverified even if the model claims otherwise", () => {
    const raw = { ...validProviderOutput(), customProposals: [{ name: "x", kind: "library", reason: "r", verification: "verified" }] };
    const result = mapProviderOutputToResult("req-1", "analysis-1", raw, allowedItemIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.customProposals[0]?.verification).toBe("unverified");
  });

  it("rejects output missing a required field (AC-021: invalid schema is rejected)", () => {
    const raw = validProviderOutput();
    delete (raw as { warnings?: unknown }).warnings;
    const result = mapProviderOutputToResult("req-1", "analysis-1", raw, allowedItemIds);
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
  });

  it("rejects an out-of-range confidence value", () => {
    const raw = validProviderOutput();
    raw.classification.confidence = 1.5;
    const result = mapProviderOutputToResult("req-1", "analysis-1", raw, allowedItemIds);
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
  });

  it("rejects a non-object provider output entirely", () => {
    const result = mapProviderOutputToResult("req-1", "analysis-1", "not an object", allowedItemIds);
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
  });
});

describe("buildErrorEnvelope / HTTP_STATUS_BY_CODE (API_CONTRACT.md)", () => {
  it("builds a stable envelope with the documented shape", () => {
    const envelope = buildErrorEnvelope("req-1", "AI_RATE_LIMITED");
    expect(envelope).toEqual({
      schemaVersion: 1,
      requestId: "req-1",
      error: {
        code: "AI_RATE_LIMITED",
        message: expect.any(String),
        retryable: true,
        fallback: expect.any(String),
      },
    });
  });

  it("maps every stable error code to its documented HTTP status", () => {
    expect(HTTP_STATUS_BY_CODE.PAYLOAD_TOO_LARGE).toBe(413);
    expect(HTTP_STATUS_BY_CODE.ORIGIN_NOT_ALLOWED).toBe(403);
    expect(HTTP_STATUS_BY_CODE.AI_RATE_LIMITED).toBe(429);
    expect(HTTP_STATUS_BY_CODE.AI_TIMEOUT).toBe(504);
    expect(HTTP_STATUS_BY_CODE.AI_PROVIDER_ERROR).toBe(502);
    expect(HTTP_STATUS_BY_CODE.INTERNAL_ERROR).toBe(500);
  });
});
