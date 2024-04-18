import type { Chain } from "@stakekit/rainbowkit";
import { getNetworkLogo } from "../../../utils";
import { Networks } from "@stakekit/common";

export const polkadot = {
  id: 9999,
  name: "Polkadot",
  iconUrl: getNetworkLogo(Networks.Polkadot),
  nativeCurrency: {
    decimals: 10,
    name: "Polkadot",
    symbol: "DOT",
  },
  rpcUrls: {
    public: {
      http: [
        "https://rpc.polkadot.io",
        "https://flashy-side-arrow.dot-mainnet.quiknode.pro/97d5006f66e37488fb9dc1575ef8960e3870dd0f/",
      ],
      webSocket: ["wss://rpc.polkadot.io"],
    },
    default: {
      http: [
        "https://rpc.polkadot.io",
        "https://flashy-side-arrow.dot-mainnet.quiknode.pro/97d5006f66e37488fb9dc1575ef8960e3870dd0f/",
      ],
      webSocket: ["wss://rpc.polkadot.io"],
    },
  },
} as const satisfies Chain;
