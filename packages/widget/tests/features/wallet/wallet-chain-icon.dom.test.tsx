import { act } from "react";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { WalletChainIcon } from "../../../src/features/wallet/ui/wallet-dialog/chain-icon";
import { render } from "../../utils/test-utils.dom.tsx";

const brokenUrl = "https://assets.example.invalid/networks/broken.svg";

describe("WalletChainIcon", () => {
  it("replaces a chain icon that fails to load with the chain monogram", async () => {
    const { container } = await render(
      <WalletChainIcon chain={{ ...mainnet, iconUrl: brokenUrl }} />
    );
    const img = container.querySelector("img");

    expect(img?.getAttribute("src")).toBe(brokenUrl);

    await act(async () => {
      img?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg[role='img']")?.textContent).toBe("E");
  });

  it("shows the chain monogram when the chain has no icon", async () => {
    const { container } = await render(
      <WalletChainIcon
        chain={{ ...mainnet, id: 424242, name: "Zora Test", iconUrl: null }}
      />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg[role='img']")?.textContent).toBe("Z");
  });
});
