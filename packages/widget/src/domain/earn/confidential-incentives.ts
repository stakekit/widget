import type { EarnYieldWithProvider } from "./yield-schema";

const zamaIncentivesUrl = (vault: string, slug: string) =>
  `https://app.zama.org/earn/ethereum/${vault}/${slug}`;

// Zama's vault pages, where holders enable delegation for extra incentives.
const confidentialIncentivesUrls: Record<string, string> = {
  "ethereum-usdc-zama-steakhouse-usdc-confidential-vault": zamaIncentivesUrl(
    "0xbEEF00A59B577423653A1526c7009bdE103F542B",
    "steakhouse-confidential-prime-usdc"
  ),
  "ethereum-usdt-zama-flowdesk-usdt-high-yield-confidential-vault":
    zamaIncentivesUrl(
      "0xb48C056C5608bA2Ee4cD94AF2bF4b1F25295Bd7e",
      "flowdesk-usdt-high-yield"
    ),
  "ethereum-usdc-zama-rockawayx-usdc-rwa-confidential-vault": zamaIncentivesUrl(
    "0xc207d3f66537D7F66456808379A0E560cF20Da36",
    "rockawayx-usdc-rwa"
  ),
  "ethereum-usdt-zama-steakhouse-usdt-prime-confidential-vault":
    zamaIncentivesUrl(
      "0xbeef003C68896c7D2c3c60d363e8d71a49Ab2bf9",
      "steakhouse-usdt-prime"
    ),
  "ethereum-wbtc-zama-wintermute-wbtc-confidential-vault": zamaIncentivesUrl(
    "0x3d5EcCb62974178236A768A7ef14D3ce468Fbe91",
    "confidential-wintermute-wbtc"
  ),
  "ethereum-ausd-zama-bitwise-ausd-rwa-confidential-vault": zamaIncentivesUrl(
    "0xB344e331A3cDa61D329fb3Cca2Be5942da87c418",
    "bitwise-ausd-premium-rwa"
  ),
};

export const getConfidentialIncentivesUrl = (yieldDto: EarnYieldWithProvider) =>
  confidentialIncentivesUrls[yieldDto.id] ?? null;
