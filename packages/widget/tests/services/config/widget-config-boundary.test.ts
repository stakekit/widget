import { Result } from "effect";
import { describe, expect, it } from "vitest";
import { ProviderId, YieldId } from "../../../src/domain/identity/identifiers";
import type { SKHostConfiguration } from "../../../src/public-api/react-types";
import type {
  SettingsProps,
  SKBorrowWallet,
} from "../../../src/public-api/types";
import {
  decodeHostConfiguration,
  InvalidHostConfiguration,
} from "../../../src/services/config/widget-config-boundary";

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

  it.each([
    {
      missing: "sendBorrowTransaction",
      provider: {
        sendTransaction: async () => "hash",
        signMessage: async () => "signature",
        signTypedData: async () => "typed-signature",
        switchChain: async () => {},
      },
    },
    {
      missing: "signTypedData",
      provider: {
        sendBorrowTransaction: async () => ({ txHash: "hash" }),
        sendTransaction: async () => "hash",
        signMessage: async () => "signature",
        switchChain: async () => {},
      },
    },
  ])(
    "rejects Borrow when the external provider has no $missing",
    ({ provider }) => {
      const result = decodeHostConfiguration({
        apiKey: "api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        externalProviders: {
          currentAddress: "0xWallet",
          provider,
          type: "generic",
        },
        variant: "default",
      } as unknown as SKHostConfiguration);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.issues).toEqual([
          "borrow-provider-capability-missing",
        ]);
        expect(result.failure.issuePaths).toEqual([
          "externalProviders.provider",
        ]);
      }
    }
  );

  it.each([
    { mountFixed: undefined, phase: "mount" },
    {
      mountFixed: {
        apiKey: "api-key",
        baseUrl: undefined,
        borrowApiUrl: undefined,
        borrowEnabled: true,
        yieldsApiUrl: undefined,
      },
      phase: "update",
    },
  ])(
    "rejects Borrow with a primitive external provider on $phase",
    ({ mountFixed }) => {
      const result = decodeHostConfiguration(
        {
          apiKey: "api-key",
          borrowEnabled: true,
          dashboardVariant: true,
          externalProviders: {
            currentAddress: "0xWallet",
            provider: "invalid",
            type: "generic",
          },
          variant: "default",
        } as unknown as SKHostConfiguration,
        mountFixed
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(InvalidHostConfiguration);
        expect(result.failure.issues).toEqual([
          "borrow-provider-capability-missing",
        ]);
        expect(result.failure.issuePaths).toEqual([
          "externalProviders.provider",
        ]);
      }
    }
  );

  it("captures Borrow capability from borrowEnabled, not provider flags", () => {
    const provider: SKBorrowWallet = {
      sendBorrowTransaction: async () => ({ type: "success", txHash: "hash" }),
      sendTransaction: async () => "hash",
      signMessage: async () => "signature",
      signTypedData: async () => ({
        type: "success",
        signature: "typed-signature",
      }),
      switchChain: async () => {},
    };
    const decode = (borrowEnabled: boolean) =>
      decodeHostConfiguration({
        apiKey: "api-key",
        borrowEnabled,
        dashboardVariant: true,
        externalProviders: {
          currentAddress: "0xWallet",
          provider,
          type: "generic",
        },
        variant: "default",
      });

    const enabled = decode(true);
    const disabled = decode(false);

    expect(Result.isSuccess(enabled) && Result.isSuccess(disabled)).toBe(true);
    if (Result.isSuccess(enabled) && Result.isSuccess(disabled)) {
      expect(enabled.success.configuration.externalProviders).toMatchObject({
        borrow: true,
        provider,
      });
      expect(disabled.success.configuration.externalProviders).toMatchObject({
        borrow: false,
        provider,
      });
    }
  });

  it("decodes Borrow capability from mount-fixed settings over the host's", () => {
    const provider: SKBorrowWallet = {
      sendBorrowTransaction: async () => ({ type: "success", txHash: "hash" }),
      sendTransaction: async () => "hash",
      signMessage: async () => "signature",
      signTypedData: async () => ({
        type: "success",
        signature: "typed-signature",
      }),
      switchChain: async () => {},
    };

    const result = decodeHostConfiguration(
      {
        apiKey: "rotated-api-key",
        borrowEnabled: false,
        dashboardVariant: true,
        externalProviders: {
          currentAddress: "0xWallet",
          provider,
          type: "generic",
        },
        variant: "default",
      },
      {
        apiKey: "api-key",
        baseUrl: undefined,
        borrowApiUrl: undefined,
        borrowEnabled: true,
        yieldsApiUrl: undefined,
      }
    );

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration).toMatchObject({
        apiKey: "api-key",
        borrowEnabled: true,
        externalProviders: { borrow: true, provider },
      });
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
      } as unknown as NonNullable<SettingsProps["theme"]>,
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

  it("drops a validatorsConfig entry under an unknown network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      validatorsConfig: {
        "*": { preferredOnly: true },
        ethereum: { allowed: ["0xvalidator"] },
        "not-a-network": { blocked: ["0xother"] },
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.validatorsConfig).toEqual({
        "*": { preferredOnly: true },
        ethereum: { allowed: ["0xvalidator"] },
      });
      expect(result.success.warnings).toEqual([
        {
          _tag: "UnknownNetworkKey",
          field: "validatorsConfig",
          key: "not-a-network",
        },
      ]);
    }
  });

  it("drops preferred token yields under an unknown network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      preferredTokenYieldsPerNetwork: {
        ethereum: { "ethereum-": "*" },
        "not-a-network": { "not-a-network-": "*" },
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(
        result.success.configuration.preferredTokenYieldsPerNetwork
      ).toEqual({ ethereum: { "ethereum-": "*" } });
      expect(result.success.warnings).toEqual([
        {
          _tag: "UnknownNetworkKey",
          field: "preferredTokenYieldsPerNetwork",
          key: "not-a-network",
        },
      ]);
    }
  });

  it("decodes preferred token yields as yield IDs or the default choice, dropping an invalid one", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      preferredTokenYieldsPerNetwork: {
        ethereum: {
          "ethereum-": "ethereum-eth-lido-staking",
          "ethereum-0xa": "*",
          "ethereum-0xb": "",
        },
      },
      variant: "default",
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(
        result.success.configuration.preferredTokenYieldsPerNetwork
      ).toEqual({
        ethereum: {
          "ethereum-": YieldId.make("ethereum-eth-lido-staking"),
          "ethereum-0xa": "*",
        },
      });
      expect(result.success.warnings).toEqual([
        {
          _tag: "InvalidEntry",
          field: "preferredTokenYieldsPerNetwork",
          path: "ethereum.ethereum-0xb",
        },
      ]);
    }
  });

  it("drops a null preferred token yield under a known network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      hideGasFee: true,
      preferredTokenYieldsPerNetwork: {
        ethereum: { "ethereum-": null, "ethereum-0xa": "*" },
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.hideGasFee).toBe(true);
      expect(
        result.success.configuration.preferredTokenYieldsPerNetwork
      ).toEqual({ ethereum: { "ethereum-0xa": "*" } });
      expect(result.success.warnings).toEqual([
        {
          _tag: "InvalidEntry",
          field: "preferredTokenYieldsPerNetwork",
          path: "ethereum.ethereum-",
        },
      ]);
    }
  });

  it("drops a non-string chainIconMapping value under an unknown network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      chainIconMapping: {
        ethereum: "https://icons.example/ethereum.svg",
        "not-a-network": 42,
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.chainIconMapping).toEqual({
        ethereum: "https://icons.example/ethereum.svg",
      });
      expect(result.success.warnings).toEqual([
        {
          _tag: "UnknownNetworkKey",
          field: "chainIconMapping",
          key: "not-a-network",
        },
      ]);
    }
  });

  it("drops a malformed validatorsConfig policy under an unknown network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      validatorsConfig: {
        ethereum: { preferredOnly: true },
        "not-a-network": { allowed: "0xvalidator" },
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.validatorsConfig).toEqual({
        ethereum: { preferredOnly: true },
      });
      expect(result.success.warnings).toEqual([
        {
          _tag: "UnknownNetworkKey",
          field: "validatorsConfig",
          key: "not-a-network",
        },
      ]);
    }
  });

  it("drops an invalid yieldProviderOrder provider ID and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      yieldProviderOrder: { defi: ["morpho", "", "aave"], stake: ["lido"] },
      variant: "default",
    });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.yieldProviderOrder).toEqual({
        defi: [ProviderId.make("morpho"), ProviderId.make("aave")],
        stake: [ProviderId.make("lido")],
      });
      expect(result.success.warnings).toEqual([
        { _tag: "InvalidEntry", field: "yieldProviderOrder", path: "defi.1" },
      ]);
    }
  });

  it("drops a chainIconMapping entry under an unknown network and keeps the rest", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      chainIconMapping: {
        ethereum: "https://icons.example/ethereum.svg",
        "not-a-network": "https://icons.example/other.svg",
      },
      variant: "default",
    } as unknown as SKHostConfiguration);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.configuration.chainIconMapping).toEqual({
        ethereum: "https://icons.example/ethereum.svg",
      });
      expect(result.success.warnings).toEqual([
        {
          _tag: "UnknownNetworkKey",
          field: "chainIconMapping",
          key: "not-a-network",
        },
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
