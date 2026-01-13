import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitPublicIssueAction } from "~/app/report/actions";
import { createIssue } from "~/services/issues";
import { createClient } from "~/lib/supabase/server";
import { checkPublicIssueLimit } from "~/lib/rate-limit";
import { db } from "~/server/db";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = `NEXT_REDIRECT;replace;${url};`;
    throw error;
  }),
  isRedirectError: (error: any) => {
    return error?.digest?.startsWith("NEXT_REDIRECT");
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    query: {
      machines: {
        findFirst: vi.fn(),
      },
      userProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock services
vi.mock("~/services/issues", () => ({
  createIssue: vi.fn(),
}));

// Mock rate limit
vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn(),
  formatResetTime: vi.fn(() => "10 minutes"),
  getClientIp: vi.fn(() => Promise.resolve("127.0.0.1")),
}));

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

describe("submitPublicIssueAction", () => {
  const mockUser = { id: "user-123" };
  const initialState = { error: "" };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful auth (guest)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    // Setup rate limit success
    vi.mocked(checkPublicIssueLimit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    // Setup DB mock for fetching machine
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: "machine-123",
      initials: "MM",
    } as any);

    // Setup service mock
    vi.mocked(createIssue).mockResolvedValue({
      id: "issue-123",
      issueNumber: 1,
      machineInitials: "MM",
    } as any);
  });

  it("should return generic error message when createIssue fails", async () => {
    // Mock service error with sensitive info
    const sensitiveError =
      "Database connection failed: user=postgres password=secret";
    vi.mocked(createIssue).mockRejectedValue(new Error(sensitiveError));

    const formData = new FormData();
    formData.append("machineId", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("title", "Test Issue");
    formData.append("severity", "minor");
    formData.append("consistency", "intermittent");

    const result = await submitPublicIssueAction(initialState as any, formData);

    // Expect generic error message
    expect(result).toEqual({
      error: "Unable to submit the issue. Please try again.",
    });
  });
});
