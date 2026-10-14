import { afterEach, describe, expect, it } from "vitest";
import { isLedgerDappBrowserProvider } from "../../../src/services/wallet/browser-environment";

const originalHref = window.location.href;

afterEach(() => {
  window.history.replaceState({}, "", originalHref);
});

describe("wallet browser environment", () => {
  it("captures the current Ledger embed mode for each application generation", () => {
    window.history.replaceState({}, "", "/?embed=true");
    expect(isLedgerDappBrowserProvider()).toBe(true);

    window.history.replaceState({}, "", "/");
    expect(isLedgerDappBrowserProvider()).toBe(false);

    window.history.replaceState({}, "", "/?embed=true");
    expect(isLedgerDappBrowserProvider()).toBe(true);
  });
});
