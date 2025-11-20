import { avalanche, mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { SKApp, type SKAppProps } from "../../../src/App";
import { solana, ton } from "../../../src/domain/types/chains/misc";
import { formatAddress } from "../../../src/utils";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./setup";

describe("External Provider", () => {
  it("Handles changing address and supported chains correctly", async () => {
    setup();

    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => "hash");

    const skProps = {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        provider: {
          signMessage: async () => "hash",
          switchChain: switchChainSpy,
          sendTransaction: sendTransactionSpy,
        },
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [mainnet.id, avalanche.id, solana.id, ton.id],
      },
    } satisfies SKAppProps;

    const app = await renderApp({ skProps });

    await expect
      .element(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      )
      .toBeInTheDocument();

    const chainNames = {
      eth: "Ethereum",
      avalanche: "Avalanche",
      solana: "Solana",
      ton: "Ton",
    } as const;

    const chainText = app.getByText(
      new RegExp(
        `${chainNames.eth}|${chainNames.avalanche}|${chainNames.solana}|${chainNames.ton}`
      )
    );

    await expect.element(chainText).toBeInTheDocument();

    await chainText.click();

    const getChainOptions = () =>
      app
        .getByTestId(/^rk-chain-option/)
        .elements()
        .filter((el) => (el as HTMLButtonElement).type === "button");

    await expect.poll(() => getChainOptions().length).toBe(4);

    const solanaOption = app
      .getByTestId(/^rk-chain-option/)
      .getByText(chainNames.solana);

    await solanaOption.click();

    await expect.poll(() => switchChainSpy).toHaveBeenCalledWith(501);

    await userEvent.keyboard("[Escape]");

    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{
          ...skProps.externalProviders,
          supportedChainIds: [avalanche.id, ton.id],
        }}
      />
    );

    await expect
      .poll(() =>
        app.getByText(new RegExp(`${chainNames.avalanche}|${chainNames.ton}`))
      )
      .toBeTruthy();

    const chainButton = app.getByText(
      new RegExp(`${chainNames.avalanche}|${chainNames.ton}`)
    );

    await chainButton.click();

    await expect.poll(() => getChainOptions().length).toBe(2);

    const tonOption = app
      .getByTestId(/^rk-chain-option/)
      .getByText(chainNames.ton);

    await tonOption.click();

    await expect.poll(() => switchChainSpy).toHaveBeenCalledWith(ton.id);

    await userEvent.keyboard("[Escape]");

    expect(sendTransactionSpy).not.toHaveBeenCalled();

    skProps.externalProviders.currentAddress =
      "0xB7c5273e79E2aDD234EBC07d87F3824e0f94B2f7";

    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{
          ...skProps.externalProviders,
          supportedChainIds: [avalanche.id, ton.id],
        }}
      />
    );

    await expect
      .element(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      )
      .toBeInTheDocument();

    const prevAddress = skProps.externalProviders.currentAddress;
    skProps.externalProviders.currentAddress = "";

    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{
          ...skProps.externalProviders,
          supportedChainIds: [avalanche.id, ton.id],
        }}
      />
    );

    await expect
      .poll(() => app.getByText(formatAddress(prevAddress)).length)
      .toBe(0);

    skProps.externalProviders.currentAddress =
      "0xB7c5273e79E2aDD234EBC07d87F3824e0f94B2f7";

    await app.rerender(
      <SKApp
        {...skProps}
        externalProviders={{
          ...skProps.externalProviders,
          supportedChainIds: [avalanche.id, ton.id],
        }}
      />
    );

    await expect
      .element(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      )
      .toBeInTheDocument();
    app.unmount();
  });
});
