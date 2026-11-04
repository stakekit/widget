import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { WalletChainIcon } from "../../../src/features/wallet/ui/wallet-dialog/chain-icon";
import { render } from "../../utils/test-utils.dom.tsx";

const brokenUrl = "https://assets.example.invalid/networks/broken.svg";

describe("WalletChainIcon", () => {
  it("shows the chain's initial until its icon loads, so a failing icon leaves it", async () => {
    const { container } = await render(
      <WalletChainIcon chain={{ ...mainnet, iconUrl: brokenUrl }} />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("E");
  });

  it("shows the chain's initial when the chain has no icon", async () => {
    const { container } = await render(
      <WalletChainIcon
        chain={{ ...mainnet, id: 424242, name: "Zora Test", iconUrl: null }}
      />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("Z");
  });
});
