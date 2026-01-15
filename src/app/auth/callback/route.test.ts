import { describe, it, expect } from "vitest";
import { resolveRedirectPath } from "./route";
import { isInternalUrl } from "~/lib/url";

describe("isInternalUrl", () => {
  it("should return true for root path", () => {
    expect(isInternalUrl("/")).toBe(true);
  });

  it("should return true for internal paths", () => {
    expect(isInternalUrl("/dashboard")).toBe(true);
    expect(isInternalUrl("/reset-password")).toBe(true);
    expect(isInternalUrl("/machines/123")).toBe(true);
  });

  it("should return false for external URLs", () => {
    expect(isInternalUrl("http://example.com")).toBe(false);
    expect(isInternalUrl("https://evil.com/phishing")).toBe(false);
  });

  it("should return false for protocol-relative URLs", () => {
    expect(isInternalUrl("//evil.com/phishing")).toBe(false);
    expect(isInternalUrl("//localhost/phishing")).toBe(false);
  });
});

describe("resolveRedirectPath", () => {
  const allowedHosts = ["localhost:3000", "app.example.com"];

  it("should accept valid internal path", () => {
    const result = resolveRedirectPath("/dashboard", allowedHosts);
    expect(result).toBe("/dashboard");
  });

  it("should reject external URL (open redirect prevention)", () => {
    const result = resolveRedirectPath("https://evil.com/steal-session", allowedHosts);
    expect(result).toBe("/");
  });

  it("should reject protocol-relative URL", () => {
    const result = resolveRedirectPath("//evil.com/phishing", allowedHosts);
    expect(result).toBe("/");
  });

  it("should handle paths with query params and hash", () => {
    const result = resolveRedirectPath("/dashboard?tab=issues#top", allowedHosts);
    expect(result).toBe("/dashboard?tab=issues#top");
  });

  it("should return fallback when nextParam is null", () => {
    const result = resolveRedirectPath(null, allowedHosts);
    expect(result).toBe("/");
  });

  it("should accept absolute URL matching allowed host", () => {
    const result = resolveRedirectPath("http://localhost:3000/dashboard", allowedHosts);
    expect(result).toBe("/dashboard");
  });

  it("should accept absolute URL matching another allowed host", () => {
    const result = resolveRedirectPath("https://app.example.com/dashboard", allowedHosts);
    expect(result).toBe("/dashboard");
  });

  it("should reject absolute URL not matching allowed hosts", () => {
    const result = resolveRedirectPath("https://evil.com/dashboard", allowedHosts);
    expect(result).toBe("/");
  });
});
