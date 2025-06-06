import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";

// const validAddressAndNetwork = {
//   address: "akash12z0hpqxj3txaf85zlla7zqffp7n9sl8wc3hlzh",
//   network: "akash",
// };

export const worker = setupWorker(
  http.post("*/v1/actions/enter/estimate-gas", async () => {
    return HttpResponse.json({
      amount: "0.1",
      token: {
        network: "polygon",
        coinGeckoId: "matic-network",
        name: "Polygon",
        decimals: 18,
        symbol: "MATIC",
        logoURI: "https://assets.stakek.it/tokens/matic.svg",
      },
      gasLimit: "",
    });
  })
  // http.get("*/v1/yields/celo-celo-native-staking", async () => {
  //   await delay();

  //   return HttpResponse.json({
  //     id: "celo-celo-native-staking",
  //     token: {
  //       name: "Celo",
  //       symbol: "CELO",
  //       decimals: 18,
  //       address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  //       network: "celo",
  //       coinGeckoId: "celo",
  //       logoURI: "https://assets.stakek.it/tokens/celo.svg",
  //     },
  //     tokens: [
  //       {
  //         name: "Celo",
  //         symbol: "CELO",
  //         decimals: 18,
  //         address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  //         network: "celo",
  //         coinGeckoId: "celo",
  //         logoURI: "https://assets.stakek.it/tokens/celo.svg",
  //       },
  //     ],
  //     args: {
  //       enter: {
  //         addresses: {
  //           address: {
  //             required: true,
  //             network: "celo",
  //           },
  //         },
  //         args: {
  //           amount: {
  //             required: true,
  //             minimum: 0,
  //           },
  //           validatorAddress: {
  //             required: true,
  //           },
  //         },
  //       },
  //       exit: {
  //         addresses: {
  //           address: {
  //             required: true,
  //             network: "celo",
  //           },
  //         },
  //         args: {
  //           amount: {
  //             required: true,
  //             minimum: 0,
  //           },
  //           validatorAddress: {
  //             required: true,
  //           },
  //           signatureVerification: {
  //             required: true,
  //           },
  //         },
  //       },
  //     },
  //     status: {
  //       enter: true,
  //       exit: true,
  //     },
  //     apy: 0.03992371968603679,
  //     rewardRate: 0.03992371968603679,
  //     rewardType: "apy",
  //     metadata: {
  //       cooldownPeriod: {
  //         days: 3,
  //       },
  //       defaultValidator: "0xdadbd6cfb29b054adc9c4c2ef0f21f0bbdb44871",
  //       description: "Stake your CELO natively",
  //       fee: {
  //         enabled: false,
  //       },
  //       gasFeeToken: {
  //         name: "Celo",
  //         symbol: "CELO",
  //         decimals: 18,
  //         address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  //         network: "celo",
  //         coinGeckoId: "celo",
  //         logoURI: "https://assets.stakek.it/tokens/celo.svg",
  //       },
  //       id: "celo-celo-native-staking",
  //       logoURI: "https://assets.stakek.it/tokens/celo.svg",
  //       minimumStake: 0,
  //       name: "CELO Native Staking",
  //       revshare: {
  //         enabled: true,
  //       },
  //       rewardClaiming: "auto",
  //       rewardSchedule: "day",
  //       supportsMultipleValidators: true,
  //       token: {
  //         name: "Celo",
  //         symbol: "CELO",
  //         decimals: 18,
  //         address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  //         network: "celo",
  //         coinGeckoId: "celo",
  //         logoURI: "https://assets.stakek.it/tokens/celo.svg",
  //       },
  //       type: "staking",
  //       warmupPeriod: {
  //         days: 1,
  //       },
  //       documentation: "https://docs.stakek.it/docs/celo-celo-native-staking",
  //       supportsLedgerWalletApi: true,
  //       isUnderMaintenance: false,
  //       ledgerClearSigning: true,
  //       contractAddresses: [
  //         "0x7d21685C17607338b313a7174bAb6620baD0aaB7",
  //         "0x8D6677192144292870907E3Fa8A5527fE55A7ff6",
  //         "0x6cC083Aed9e3ebe302A6336dBC7c921C9f03349E",
  //       ],
  //     },
  //     validators: [
  //       {
  //         address: "0xe92b7ba8497486e94bb59c51f595b590c4a5f894",
  //         status: "active",
  //         name: "Stakely",
  //         image: "https://assets.stakek.it/validators/stakely.png",
  //         website: "https://stakely.io/",
  //         apr: 0.0393,
  //         commission: 0.1,
  //         stakedBalance: "2263157",
  //         votingPower: 0.0090962642447408,
  //         preferred: true,
  //       },
  //       {
  //         address: "0x81cef0668e15639d0b101bdc3067699309d73bed",
  //         status: "active",
  //         name: "Chorus One",
  //         image: "https://assets.stakek.it/validators/chorus_one.png",
  //         website: "https://chorus.one/",
  //         apr: 0.04015260366943412,
  //         commission: 0.075,
  //         stakedBalance: "4056456",
  //         votingPower: 0.0163040370920639,
  //         preferred: true,
  //       },
  //     ],
  //     isAvailable: true,
  //   });
  // })
);

// http.post("*/v1/actions/enter", async () => {
//   await delay();
//   return HttpResponse.json(
//     {
//       message: "YieldUnderMaintenanceError",
//       details: { yieldId: "optimism-op-aave-v3-lending" },
//     },
//     { status: 400 }
//   );
// }),

// http.all("*", () => {
//   return passthrough();
// })
