import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";

import { WalletChainIcon } from "../../../src/features/wallet/ui/wallet-dialog/chain-icon";
import { render } from "../../utils/test-utils.dom.tsx";

describe("WalletChainIcon", () => {
  it("shows the chain's initials when the chain has no icon", async () => {
    const { container } = await render(
      <WalletChainIcon
        chain={{ ...mainnet, id: 424242, name: "Zora Test", iconUrl: null }}
      />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("ZT");
  });
});
