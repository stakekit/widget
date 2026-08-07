import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  renderSKWidget as bundledRenderSKWidget,
  SKApp as PackageSKApp,
  renderSKWidget,
  SKApp,
} from "../../src/App";
import type {
  BundledSKWidgetProps,
  SKWallet as BundledWallet,
  SKAppProps as PackageSKAppProps,
  SKWallet as PackageWallet,
} from "../../src/public-api/types";

const genericWallet: PackageWallet = {
  signMessage: vi.fn(async () => "signed-message"),
  switchChain: vi.fn(async () => undefined),
  sendTransaction: vi.fn(async () => ({
    type: "success" as const,
    txHash: "0xbroadcast-hash",
  })),
};

const packageProps = {
  apiKey: "public-contract-api-key",
  externalProviders: {
    type: "generic",
    currentAddress: "0x0000000000000000000000000000000000000001",
    currentChain: 1,
    supportedChainIds: [1],
    provider: genericWallet,
  },
} satisfies PackageSKAppProps;

describe("package and bundled wallet entry contracts", () => {
  it("exports the same component and bundled renderer implementations", () => {
    expect(PackageSKApp).toBe(SKApp);
    expect(bundledRenderSKWidget).toBe(renderSKWidget);
  });

  it("keeps generic wallet callbacks Promise-based in both entry modes", () => {
    expectTypeOf<PackageWallet>().toEqualTypeOf<BundledWallet>();
    expectTypeOf(genericWallet.signMessage).returns.toEqualTypeOf<
      Promise<string>
    >();
    expectTypeOf(genericWallet.switchChain).returns.toEqualTypeOf<
      Promise<void>
    >();
    expectTypeOf(genericWallet.sendTransaction).returns.toMatchTypeOf<
      Promise<
        | string
        | { type: "success"; txHash: string }
        | { type: "error"; error: string }
      >
    >();
    expectTypeOf(packageProps).toMatchTypeOf<PackageSKAppProps>();
  });

  it("keeps bundled lifecycle controls aligned with package SKApp props", () => {
    type BundledRenderProps = Parameters<typeof bundledRenderSKWidget>[0];
    type BundledController = ReturnType<typeof bundledRenderSKWidget>;
    const bundledRenderProps = {
      ...packageProps,
      container: {} as HTMLElement,
    } satisfies BundledRenderProps;

    expectTypeOf(packageProps).toMatchTypeOf<BundledSKWidgetProps>();
    expectTypeOf(bundledRenderProps).toMatchTypeOf<BundledRenderProps>();
    expectTypeOf<BundledController>().toEqualTypeOf<{
      rerender: (newProps: PackageSKAppProps) => void;
      unmount: () => void;
    }>();
  });
});
