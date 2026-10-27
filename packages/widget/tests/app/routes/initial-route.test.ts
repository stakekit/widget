import { describe, expect, it } from "vitest";
import { resolveInitialRoutePath } from "../../../src/app/routes/model/initial-route";
import type { WidgetLayout } from "../../../src/services/config/widget-config-model";

const resolve = ({
  borrowAvailable = false,
  layout = "Compact",
  tab,
}: {
  readonly borrowAvailable?: boolean;
  readonly layout?: WidgetLayout;
  readonly tab: "earn" | "positions" | "manage" | "activity" | "borrow" | null;
}) => resolveInitialRoutePath({ borrowAvailable, layout, tab });

describe("initial route path", () => {
  it("starts the Compact Layout on the tab named by the deep link", () => {
    expect(resolve({ tab: "positions" })).toBe("/positions");
    expect(resolve({ tab: "manage" })).toBe("/positions");
    expect(resolve({ tab: "earn" })).toBe("/");
  });

  it("starts on the earn page when no usable tab is given", () => {
    expect(resolve({ tab: null })).toBe("/");
  });

  it("starts both Layouts on activity", () => {
    expect(resolve({ tab: "activity" })).toBe("/activity");
    expect(resolve({ layout: "Dashboard", tab: "activity" })).toBe("/activity");
  });

  it("maps Dashboard manage aliases to the positions route", () => {
    expect(resolve({ layout: "Dashboard", tab: "positions" })).toBe(
      "/positions"
    );
    expect(resolve({ layout: "Dashboard", tab: "manage" })).toBe("/positions");
  });

  it("starts Dashboard borrow only when the feature is available", () => {
    expect(
      resolve({ borrowAvailable: true, layout: "Dashboard", tab: "borrow" })
    ).toBe("/borrow");
    expect(resolve({ layout: "Dashboard", tab: "borrow" })).toBe("/");
  });

  it("does not open borrow in the Compact Layout", () => {
    expect(resolve({ borrowAvailable: true, tab: "borrow" })).toBe("/");
  });
});
