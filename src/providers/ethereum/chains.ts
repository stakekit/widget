import type { Chain } from "@stakekit/rainbowkit";
import { getTokenLogo } from "../../utils";

export const viction = {
  id: 88,
  name: "Viction",
  iconUrl: getTokenLogo("vic"),
  nativeCurrency: {
    decimals: 18,
    name: "Viction",
    symbol: "VIC",
  },
  rpcUrls: {
    public: { http: ["https://rpc.tomochain.com"] },
    default: { http: ["https://rpc.tomochain.com"] },
  },
} as const satisfies Chain;
