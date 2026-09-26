import { describe, expect, it } from "vitest";
import { entryInputSchema, normalizeEvidenceUrl } from "@/lib/validation/evaluation";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("normalizeEvidenceUrl", () => {
  it("treats blank input as no link", () => {
    expect(normalizeEvidenceUrl("")).toBe("");
    expect(normalizeEvidenceUrl("   ")).toBe("");
  });

  it("keeps full http(s) URLs", () => {
    expect(normalizeEvidenceUrl("https://www.sbp.org.pk/raast")).toBe("https://www.sbp.org.pk/raast");
    expect(normalizeEvidenceUrl("http://example.org")).toBe("http://example.org/");
  });

  it("adds https:// to bare domains", () => {
    expect(normalizeEvidenceUrl("sbp.org.pk/report.pdf")).toBe("https://sbp.org.pk/report.pdf");
  });

  it("rejects half-typed or non-web links", () => {
    expect(normalizeEvidenceUrl("https://")).toBeNull();
    expect(normalizeEvidenceUrl("sbp")).toBeNull();
    expect(normalizeEvidenceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeEvidenceUrl("ftp://files.example.org")).toBeNull();
  });
});

describe("entryInputSchema evidenceUrl", () => {
  const base = { parameterKey: "messaging_standards", rowKey: "main" };

  it("stores the normalized link", () => {
    const parsed = entryInputSchema.parse({ ...base, evidenceUrl: "worldbank.org/findex" });
    expect(parsed.evidenceUrl).toBe("https://worldbank.org/findex");
  });

  it("accepts empty and null", () => {
    expect(entryInputSchema.parse({ ...base, evidenceUrl: "" }).evidenceUrl).toBe("");
    expect(entryInputSchema.parse({ ...base, evidenceUrl: null }).evidenceUrl).toBeNull();
  });

  it("rejects an invalid link with a readable message", () => {
    const result = entryInputSchema.safeParse({ ...base, evidenceUrl: "not a url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/valid evidence link/);
  });
});

describe("safeRedirectPath", () => {
  it("allows same-origin paths", () => {
    expect(safeRedirectPath("/evaluations/abc/results")).toBe("/evaluations/abc/results");
  });

  it("falls back for missing or external targets", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });
});
