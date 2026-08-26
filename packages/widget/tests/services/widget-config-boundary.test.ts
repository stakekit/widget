import { Result } from "effect";
import { describe, expect, it } from "vitest";
import type {
  SettingsProps,
  SKHostConfiguration,
} from "../../src/public-api/types";
import {
  decodeHostConfiguration,
  InvalidHostConfiguration,
} from "../../src/services/config/widget-config-boundary";

describe("decodeHostConfiguration", () => {
  it("rejects a non-object Host Configuration", () => {
    const result = decodeHostConfiguration(
      null as unknown as SKHostConfiguration
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(InvalidHostConfiguration);
      expect(result.failure.issues).toEqual([
        "host-configuration-decode-failed",
      ]);
    }
  });

  it("rejects an empty API key", () => {
    const result = decodeHostConfiguration({
      apiKey: "",
      variant: "default",
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual([
        "host-configuration-decode-failed",
      ]);
      expect(result.failure.issuePaths).toEqual(["apiKey"]);
    }
  });

  it("reports only independent invalid Host Configuration choices", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      variant: "default",
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(InvalidHostConfiguration);
      expect(result.failure.issues).toEqual(["borrow-requires-dashboard"]);
      expect(result.failure.issuePaths).toEqual(["dashboardVariant"]);
    }
  });

  it("collects independent semantic issues and their paths", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      dashboardVariant: false,
      variant: "default",
      yieldGrouping: "flat",
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual([
        "borrow-requires-dashboard",
        "borrow-requires-category-grouping",
      ]);
      expect(result.failure.issuePaths).toEqual([
        "dashboardVariant",
        "yieldGrouping",
      ]);
    }
  });

  it("rejects Borrow with a non-Borrow external-provider discriminant", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      dashboardVariant: true,
      externalProviders: {
        currentAddress: "0xWallet",
        provider: {
          sendTransaction: async () => "hash",
          signMessage: async () => "signature",
          switchChain: async () => {},
        },
        type: "generic",
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual([
        "borrow-provider-capability-missing",
      ]);
      expect(result.failure.issuePaths).toEqual(["externalProviders.provider"]);
    }
  });

  it("preserves a typed opaque Borrow provider without inspecting its shape", () => {
    const provider = {
      sendBorrowTransaction: async () => "hash",
      sendTransaction: async () => "hash",
      signMessage: async () => "signature",
      switchChain: async () => {},
    };
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      dashboardVariant: true,
      externalProviders: {
        currentAddress: "0xWallet",
        provider,
        supportsBorrow: true,
        type: "generic",
      },
      variant: "default",
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.externalProviders?.provider).toBe(
        provider
      );
    }
  });

  it("rejects an external provider without its opaque provider capability", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      externalProviders: {
        currentAddress: "0xWallet",
        type: "generic",
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual([
        "host-configuration-decode-failed",
      ]);
      expect(result.failure.issuePaths).toEqual(["externalProviders.provider"]);
    }
  });

  it("rejects the Zerion variant without its chain modal capability", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      variant: "zerion",
    } as SKHostConfiguration);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual(["zerion-chain-modal-missing"]);
      expect(result.failure.issuePaths).toEqual(["chainModal"]);
    }
  });

  it("returns tagged warnings for recovered Host Configuration values", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      theme: {
        color: {
          accent: 42,
          background: "#fff",
        },
      } as unknown as SettingsProps["theme"],
      variant: "default",
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.theme).toEqual({
        color: { background: "#fff" },
      });
      expect(result.success.warnings).toEqual([
        { _tag: "Theme", issue: "invalid-theme-token" },
      ]);
    }
  });

  it("rejects malformed value-shaped input with sanitized paths", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      dashboardVariant: "yes",
      secretHostValue: "must-not-appear-in-diagnostics",
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(InvalidHostConfiguration);
      expect(result.failure.issues).toEqual([
        "host-configuration-decode-failed",
      ]);
      expect(result.failure.issuePaths).toEqual(["dashboardVariant"]);
      expect(JSON.stringify(result.failure)).not.toContain(
        "must-not-appear-in-diagnostics"
      );
    }
  });
});
