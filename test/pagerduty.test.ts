// Tests for core/backends/pagerduty.ts
// Uses dependency injection (not vi.mock/vi.spyOn) to avoid Bun runtime dependency.

import { describe, it, expect, afterEach } from "vitest";
import {
  mapPagerDutyPriority,
  incidentToTodoItem,
  PagerDutyBackend,
  resolvePagerDutyConfig,
} from "../core/backends/pagerduty.ts";
import type {
  PagerDutyIncident,
  PagerDutyIncidentListResponse,
  PagerDutyIncidentResponse,
  HttpFetcher,
} from "../core/backends/pagerduty.ts";

/** Create a mock HttpFetcher that returns a fixed result. */
function mockFetcher(result: {
  ok: boolean;
  status: number;
  json: unknown;
}): HttpFetcher {
  return (_url, _options) => result;
}

/** Create a mock HttpFetcher that captures calls and returns a fixed result. */
function spyFetcher(result: {
  ok: boolean;
  status: number;
  json: unknown;
}): {
  fetcher: HttpFetcher;
  calls: Array<{
    url: string;
    options: { method: string; headers: Record<string, string>; body?: string };
  }>;
} {
  const calls: Array<{
    url: string;
    options: { method: string; headers: Record<string, string>; body?: string };
  }> = [];
  const fetcher: HttpFetcher = (url, options) => {
    calls.push({ url, options });
    return result;
  };
  return { fetcher, calls };
}

/** Create a sample PagerDuty incident for testing. */
function sampleIncident(
  overrides: Partial<PagerDutyIncident> = {},
): PagerDutyIncident {
  return {
    id: "PT4KHLK",
    incident_number: 1234,
    title: "Server is on fire",
    description: "The production server is experiencing issues",
    urgency: "high",
    status: "triggered",
    priority: { name: "P2 - High" },
    service: { summary: "web-api" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapPagerDutyPriority
// ---------------------------------------------------------------------------
describe("mapPagerDutyPriority", () => {
  it("maps high urgency + P1 priority to critical", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        priority: { name: "P1 - Critical" },
      }),
    ).toBe("critical");
  });

  it("maps high urgency + SEV1 priority to critical", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        priority: { name: "SEV1 - Critical" },
      }),
    ).toBe("critical");
  });

  it("maps high urgency + P1 (case insensitive in name) to critical", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        priority: { name: "p1 emergency" },
      }),
    ).toBe("critical");
  });

  it("maps high urgency without P1/SEV1 to high", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        priority: { name: "P2 - High" },
      }),
    ).toBe("high");
  });

  it("maps high urgency with null priority to high", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        priority: null,
      }),
    ).toBe("high");
  });

  it("maps low urgency to medium", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "low",
        priority: null,
      }),
    ).toBe("medium");
  });

  it("maps suppressed incidents to low", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "high",
        is_suppressed: true,
        priority: { name: "P1 - Critical" },
      }),
    ).toBe("low");
  });

  it("maps suppressed low-urgency incidents to low", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "low",
        is_suppressed: true,
        priority: null,
      }),
    ).toBe("low");
  });

  it("defaults to medium for unknown urgency", () => {
    expect(
      mapPagerDutyPriority({
        urgency: "unknown" as "high" | "low",
        priority: null,
      }),
    ).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// incidentToTodoItem
// ---------------------------------------------------------------------------
describe("incidentToTodoItem", () => {
  it("converts a full incident to TodoItem shape", () => {
    const incident = sampleIncident();
    const item = incidentToTodoItem(incident);

    expect(item.id).toBe("PGD-1234");
    expect(item.title).toBe("Server is on fire");
    expect(item.priority).toBe("high");
    expect(item.domain).toBe("web-api");
    expect(item.rawText).toBe(
      "The production server is experiencing issues",
    );
    expect(item.dependencies).toEqual([]);
    expect(item.bundleWith).toEqual([]);
    expect(item.status).toBe("open");
    expect(item.filePath).toBe("");
    expect(item.repoAlias).toBe("");
  });

  it("handles incident with no description (empty rawText)", () => {
    const incident = sampleIncident({ description: null });
    const item = incidentToTodoItem(incident);
    expect(item.rawText).toBe("");
  });

  it("handles incident with no service (uncategorized domain)", () => {
    const incident = sampleIncident({ service: null });
    const item = incidentToTodoItem(incident);
    expect(item.domain).toBe("uncategorized");
  });

  it("includes first alert body in rawText", () => {
    const incident = sampleIncident({
      alerts: [
        {
          body: {
            details: "Alert: CPU at 99%",
          },
        },
        {
          body: {
            details: "Second alert: disk full",
          },
        },
      ],
    });
    const item = incidentToTodoItem(incident);
    expect(item.rawText).toContain(
      "The production server is experiencing issues",
    );
    expect(item.rawText).toContain("Alert: CPU at 99%");
    // Only first alert body should be included
    expect(item.rawText).not.toContain("Second alert: disk full");
  });

  it("includes alert custom_details in rawText when details string is absent", () => {
    const incident = sampleIncident({
      description: null,
      alerts: [
        {
          body: {
            custom_details: { error: "OOMKilled", pod: "web-api-7f8b" },
          },
        },
      ],
    });
    const item = incidentToTodoItem(incident);
    expect(item.rawText).toContain("OOMKilled");
    expect(item.rawText).toContain("web-api-7f8b");
  });

  it("extracts file paths from alert details", () => {
    const incident = sampleIncident({
      alerts: [
        {
          body: {
            details:
              "Error in /app/core/server.ts at line 42\nAlso /lib/utils/auth.py failed",
          },
        },
      ],
    });
    const item = incidentToTodoItem(incident);
    expect(item.filePaths).toContain("/app/core/server.ts");
    expect(item.filePaths).toContain("/lib/utils/auth.py");
  });

  it("extracts file paths from alert custom_details", () => {
    const incident = sampleIncident({
      alerts: [
        {
          body: {
            custom_details: {
              stack_trace: "at /src/handlers/webhook.ts:15:3",
            },
          },
        },
      ],
    });
    const item = incidentToTodoItem(incident);
    expect(item.filePaths).toContain("/src/handlers/webhook.ts");
  });

  it("returns empty filePaths when no paths are found", () => {
    const incident = sampleIncident();
    const item = incidentToTodoItem(incident);
    expect(item.filePaths).toEqual([]);
  });

  it("deduplicates extracted file paths", () => {
    const incident = sampleIncident({
      description: "Error at /app/server.ts",
      alerts: [
        {
          body: {
            details: "Also at /app/server.ts line 20",
          },
        },
      ],
    });
    const item = incidentToTodoItem(incident);
    const occurrences = item.filePaths.filter(
      (p) => p === "/app/server.ts",
    );
    expect(occurrences).toHaveLength(1);
  });

  it("handles incident with multiple alerts (uses first alert body only)", () => {
    const incident = sampleIncident({
      description: null,
      alerts: [
        { body: { details: "First alert details" } },
        { body: { details: "Second alert details" } },
      ],
    });
    const item = incidentToTodoItem(incident);
    expect(item.rawText).toBe("First alert details");
  });

  it("handles incident with empty alerts array", () => {
    const incident = sampleIncident({
      description: "Only description",
      alerts: [],
    });
    const item = incidentToTodoItem(incident);
    expect(item.rawText).toBe("Only description");
  });
});

// ---------------------------------------------------------------------------
// PagerDutyBackend.list
// ---------------------------------------------------------------------------
describe("PagerDutyBackend.list", () => {
  it("returns TodoItems from PagerDuty API response", () => {
    const incidents: PagerDutyIncident[] = [
      sampleIncident({
        id: "PT1",
        incident_number: 100,
        title: "First incident",
      }),
      sampleIncident({
        id: "PT2",
        incident_number: 101,
        title: "Second incident",
        urgency: "low",
        service: null,
      }),
    ];
    const response: PagerDutyIncidentListResponse = { incidents };

    const fetcher = mockFetcher({ ok: true, status: 200, json: response });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      "svc123",
      "https://api.test",
    );
    const items = backend.list();

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("PGD-100");
    expect(items[0].title).toBe("First incident");
    expect(items[0].priority).toBe("high");
    expect(items[1].id).toBe("PGD-101");
    expect(items[1].priority).toBe("medium");
    expect(items[1].domain).toBe("uncategorized");
  });

  it("passes correct URL with service_id filter", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: { incidents: [] },
    });

    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      "svc456",
      "https://api.test",
    );
    backend.list();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.test/incidents?statuses[]=triggered&statuses[]=acknowledged&service_ids[]=svc456",
    );
    expect(calls[0].options.method).toBe("GET");
    expect(calls[0].options.headers.Authorization).toBe(
      "Token token=test-token",
    );
  });

  it("omits service_id when not configured", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: { incidents: [] },
    });

    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    backend.list();

    expect(calls[0].url).toBe(
      "https://api.test/incidents?statuses[]=triggered&statuses[]=acknowledged",
    );
  });

  it("returns empty array when API call fails", () => {
    const fetcher = mockFetcher({
      ok: false,
      status: 401,
      json: { error: { message: "Invalid token" } },
    });
    const backend = new PagerDutyBackend(
      "bad-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const items = backend.list();
    expect(items).toEqual([]);
  });

  it("returns empty array when response has no incidents array", () => {
    const fetcher = mockFetcher({ ok: true, status: 200, json: {} });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const items = backend.list();
    expect(items).toEqual([]);
  });

  it("returns empty array when json is null (malformed response)", () => {
    const fetcher = mockFetcher({ ok: true, status: 200, json: null });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const items = backend.list();
    expect(items).toEqual([]);
  });

  it("returns empty array on non-200 status (graceful degradation)", () => {
    const fetcher = mockFetcher({
      ok: false,
      status: 500,
      json: { error: { message: "Internal Server Error" } },
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    expect(backend.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PagerDutyBackend.read
// ---------------------------------------------------------------------------
describe("PagerDutyBackend.read", () => {
  it("reads a single incident by PGD-N format", () => {
    const incident = sampleIncident({ id: "PT4KHLK", incident_number: 5678 });
    const response: PagerDutyIncidentResponse = { incident };
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: response,
    });

    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const item = backend.read("PGD-PT4KHLK");

    expect(item).toBeDefined();
    expect(item!.id).toBe("PGD-5678");
    expect(item!.title).toBe("Server is on fire");

    // Verify the PGD- prefix was stripped for the API call
    expect(calls[0].url).toBe("https://api.test/incidents/PT4KHLK");
  });

  it("reads a single incident by plain id string", () => {
    const incident = sampleIncident({ id: "PT_PLAIN", incident_number: 9999 });
    const response: PagerDutyIncidentResponse = { incident };
    const fetcher = mockFetcher({ ok: true, status: 200, json: response });

    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const item = backend.read("PT_PLAIN");

    expect(item).toBeDefined();
    expect(item!.id).toBe("PGD-9999");
  });

  it("returns undefined when incident not found", () => {
    const fetcher = mockFetcher({
      ok: false,
      status: 404,
      json: { error: { message: "Not Found" } },
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const item = backend.read("PGD-missing");
    expect(item).toBeUndefined();
  });

  it("returns undefined when json is null", () => {
    const fetcher = mockFetcher({ ok: true, status: 200, json: null });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const item = backend.read("PGD-x");
    expect(item).toBeUndefined();
  });

  it("returns undefined when response has no incident field", () => {
    const fetcher = mockFetcher({ ok: true, status: 200, json: {} });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    const item = backend.read("PGD-x");
    expect(item).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PagerDutyBackend.markDone
// ---------------------------------------------------------------------------
describe("PagerDutyBackend.markDone", () => {
  it("sends PUT with correct resolve payload and From header", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: {},
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "oncall@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );

    const result = backend.markDone("PGD-PT42");

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test/incidents");
    expect(calls[0].options.method).toBe("PUT");
    expect(calls[0].options.headers.From).toBe("oncall@example.com");
    expect(calls[0].options.headers.Authorization).toBe(
      "Token token=test-token",
    );

    const body = JSON.parse(calls[0].options.body!);
    expect(body.incidents).toEqual([
      {
        id: "PT42",
        type: "incident_reference",
        status: "resolved",
      },
    ]);
  });

  it("strips PGD- prefix from id", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: {},
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );

    backend.markDone("PGD-ABC");
    const body = JSON.parse(calls[0].options.body!);
    expect(body.incidents[0].id).toBe("ABC");
  });

  it("accepts plain id string", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: {},
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );

    backend.markDone("PLAIN123");
    const body = JSON.parse(calls[0].options.body!);
    expect(body.incidents[0].id).toBe("PLAIN123");
  });

  it("returns false when API call fails", () => {
    const fetcher = mockFetcher({
      ok: false,
      status: 500,
      json: { error: { message: "server error" } },
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    expect(backend.markDone("PGD-x")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PagerDutyBackend.addStatusLabel
// ---------------------------------------------------------------------------
describe("PagerDutyBackend.addStatusLabel", () => {
  it("POSTs note to correct incident URL with label as content", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 201,
      json: {},
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "oncall@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );

    const result = backend.addStatusLabel(
      "PGD-PT10",
      "status:in-progress",
    );

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test/incidents/PT10/notes");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.headers.From).toBe("oncall@example.com");

    const body = JSON.parse(calls[0].options.body!);
    expect(body.note.content).toBe("status:in-progress");
  });

  it("returns false when API call fails", () => {
    const fetcher = mockFetcher({
      ok: false,
      status: 400,
      json: { error: { message: "bad request" } },
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );
    expect(
      backend.addStatusLabel("PGD-x", "status:pr-open"),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PagerDutyBackend.removeStatusLabel
// ---------------------------------------------------------------------------
describe("PagerDutyBackend.removeStatusLabel", () => {
  it("is a no-op that returns true (notes are append-only)", () => {
    const { fetcher, calls } = spyFetcher({
      ok: true,
      status: 200,
      json: {},
    });
    const backend = new PagerDutyBackend(
      "test-token",
      "test@example.com",
      fetcher,
      undefined,
      "https://api.test",
    );

    const result = backend.removeStatusLabel(
      "PGD-PT10",
      "status:in-progress",
    );

    expect(result).toBe(true);
    // No API calls should be made
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolvePagerDutyConfig
// ---------------------------------------------------------------------------
describe("resolvePagerDutyConfig", () => {
  const originalToken = process.env.PAGERDUTY_API_TOKEN;
  const originalServiceId = process.env.PAGERDUTY_SERVICE_ID;
  const originalEmail = process.env.PAGERDUTY_FROM_EMAIL;

  afterEach(() => {
    // Restore original env vars
    if (originalToken !== undefined) {
      process.env.PAGERDUTY_API_TOKEN = originalToken;
    } else {
      delete process.env.PAGERDUTY_API_TOKEN;
    }
    if (originalServiceId !== undefined) {
      process.env.PAGERDUTY_SERVICE_ID = originalServiceId;
    } else {
      delete process.env.PAGERDUTY_SERVICE_ID;
    }
    if (originalEmail !== undefined) {
      process.env.PAGERDUTY_FROM_EMAIL = originalEmail;
    } else {
      delete process.env.PAGERDUTY_FROM_EMAIL;
    }
  });

  it("returns config when all env vars are set", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    process.env.PAGERDUTY_SERVICE_ID = "PSVC123";
    process.env.PAGERDUTY_FROM_EMAIL = "oncall@example.com";

    const result = resolvePagerDutyConfig(() => undefined);

    expect(result).toEqual({
      apiToken: "pd-test-token",
      serviceId: "PSVC123",
      fromEmail: "oncall@example.com",
    });
  });

  it("returns config with serviceId from config getter when env var is missing", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    delete process.env.PAGERDUTY_SERVICE_ID;
    process.env.PAGERDUTY_FROM_EMAIL = "oncall@example.com";

    const result = resolvePagerDutyConfig((key) =>
      key === "pagerduty_service_id" ? "config_svc" : undefined,
    );

    expect(result).toEqual({
      apiToken: "pd-test-token",
      serviceId: "config_svc",
      fromEmail: "oncall@example.com",
    });
  });

  it("returns config with undefined serviceId when not configured anywhere", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    delete process.env.PAGERDUTY_SERVICE_ID;
    process.env.PAGERDUTY_FROM_EMAIL = "oncall@example.com";

    const result = resolvePagerDutyConfig(() => undefined);

    expect(result).toEqual({
      apiToken: "pd-test-token",
      serviceId: undefined,
      fromEmail: "oncall@example.com",
    });
  });

  it("returns config with fromEmail from config getter when env var is missing", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    delete process.env.PAGERDUTY_FROM_EMAIL;

    const result = resolvePagerDutyConfig((key) =>
      key === "pagerduty_from_email" ? "config@example.com" : undefined,
    );

    expect(result).toEqual({
      apiToken: "pd-test-token",
      serviceId: undefined,
      fromEmail: "config@example.com",
    });
  });

  it("prefers env var over config getter for serviceId", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    process.env.PAGERDUTY_SERVICE_ID = "env_svc";
    process.env.PAGERDUTY_FROM_EMAIL = "oncall@example.com";

    const result = resolvePagerDutyConfig((key) =>
      key === "pagerduty_service_id" ? "config_svc" : undefined,
    );

    expect(result!.serviceId).toBe("env_svc");
  });

  it("prefers env var over config getter for fromEmail", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    process.env.PAGERDUTY_FROM_EMAIL = "env@example.com";

    const result = resolvePagerDutyConfig((key) =>
      key === "pagerduty_from_email" ? "config@example.com" : undefined,
    );

    expect(result!.fromEmail).toBe("env@example.com");
  });

  it("returns null when API token is not set", () => {
    delete process.env.PAGERDUTY_API_TOKEN;
    const result = resolvePagerDutyConfig(() => undefined);
    expect(result).toBeNull();
  });

  it("returns null when fromEmail is not available from either source", () => {
    process.env.PAGERDUTY_API_TOKEN = "pd-test-token";
    delete process.env.PAGERDUTY_FROM_EMAIL;
    const result = resolvePagerDutyConfig(() => undefined);
    expect(result).toBeNull();
  });
});
