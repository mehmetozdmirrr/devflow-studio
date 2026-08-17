import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIErrorEnvelope,
  AIProvider,
} from "@contracts/ai";

export class AIRequestError extends Error {
  readonly envelope: AIErrorEnvelope;

  constructor(envelope: AIErrorEnvelope) {
    super(envelope.error.message);
    this.name = "AIRequestError";
    this.envelope = envelope;
  }
}

function networkErrorEnvelope(requestId: string): AIErrorEnvelope {
  return {
    schemaVersion: 1,
    requestId,
    error: {
      code: "AI_PROVIDER_ERROR",
      message: "Could not reach the AI analysis endpoint.",
      retryable: true,
      fallback: "Continue with deterministic recommendations.",
    },
  };
}

function unreadableResponseEnvelope(requestId: string): AIErrorEnvelope {
  return {
    schemaVersion: 1,
    requestId,
    error: {
      code: "AI_INVALID_OUTPUT",
      message: "AI analysis returned an unreadable response.",
      retryable: true,
      fallback: "Continue with deterministic recommendations.",
    },
  };
}

/** Same-site `POST /.netlify/functions/analyze-project` client (FR-031). Never called without prior explicit consent — enforced by `aiStore`, not here. */
export class HttpAIAnalysisClient implements AIProvider {
  async analyzeProject(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    let response: Response;
    try {
      response = await fetch("/.netlify/functions/analyze-project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
    } catch {
      throw new AIRequestError(networkErrorEnvelope(request.requestId));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AIRequestError(unreadableResponseEnvelope(request.requestId));
    }

    if (!response.ok) {
      throw new AIRequestError(payload as AIErrorEnvelope);
    }
    return payload as AIAnalysisResult;
  }
}
