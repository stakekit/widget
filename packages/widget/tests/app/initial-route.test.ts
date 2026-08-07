import { describe, expect, it } from "vitest";
import { resolveInitialRoutePath } from "../../src/app/routes/initial-route";

const resolve = ({
  borrowAvailable = false,
  tab,
  variant = "classic",
}: {
  readonly borrowAvailable?: boolean;
  readonly tab: "earn" | "positions" | "manage" | "activity" | "borrow" | null;
  readonly variant?: "classic" | "dashboard";
}) => resolveInitialRoutePath({ borrowAvailable, tab, variant });

describe("initial route path", () => {
  it("starts the classic widget on the tab named by the deep link", () => {
    expect(resolve({ tab: "positions" })).toBe("/positions");
    expect(resolve({ tab: "manage" })).toBe("/positions");
    expect(resolve({ tab: "earn" })).toBe("/");
  });

  it("starts on the earn page when no usable tab is given", () => {
    expect(resolve({ tab: null })).toBe("/");
  });

  it("starts both variants on activity", () => {
    expect(resolve({ tab: "activity" })).toBe("/activity");
    expect(resolve({ tab: "activity", variant: "dashboard" })).toBe(
      "/activity"
    );
  });

  it("maps dashboard manage aliases to the positions route", () => {
    expect(resolve({ tab: "positions", variant: "dashboard" })).toBe(
      "/positions"
    );
    expect(resolve({ tab: "manage", variant: "dashboard" })).toBe("/positions");
  });

  it("starts dashboard borrow only when the feature is available", () => {
    expect(
      resolve({
        borrowAvailable: true,
        tab: "borrow",
        variant: "dashboard",
      })
    ).toBe("/borrow");
    expect(resolve({ tab: "borrow", variant: "dashboard" })).toBe("/");
  });

  it("does not expose a borrow route in the classic variant", () => {
    expect(resolve({ borrowAvailable: true, tab: "borrow" })).toBe("/");
  });
});
