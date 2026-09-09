import { describe, it, expect, beforeEach } from "vitest";

import { apiUrl, currentUser } from "./client.js";

describe("apiUrl", () => {
  it("includes the given path", () => {
    expect(apiUrl("/api/tags")).toContain("/api/tags");
  });
});

describe("currentUser", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nobody is stored", () => {
    expect(currentUser()).toBeNull();
  });

  it("returns the stored user object", () => {
    localStorage.setItem("branch_user", JSON.stringify({ user_id: 7, username: "maple" }));
    expect(currentUser()).toEqual({ user_id: 7, username: "maple" });
  });

  it("returns null on corrupt stored data instead of throwing", () => {
    localStorage.setItem("branch_user", "not-json");
    expect(currentUser()).toBeNull();
  });
});
