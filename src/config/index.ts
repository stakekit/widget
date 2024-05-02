const assetsUrl = "https://assets.stakek.it";

export const config = {
  appName: "StakeKit",
  appIcon: `${assetsUrl}/stakekit/sk-icon_320x320.png`,
  appUrl: "https://stakek.it",
  currency: "USD",
  queryClient: {
    staleTime: 1000 * 5,
    cacheTime: 1000 * 60 * 5,
  },
  walletConnectV2: {
    projectId: "10a5257c04d1d3097ff768a139c95f50",
  },
  appPrefix: "sk-widget",
  env: {
    apiUrl: import.meta.env.VITE_API_URL ?? "https://api.stakek.it/",
    isTestMode: import.meta.env.MODE === "test",
    isDevMode: import.meta.env.MODE === "development",
  },
  assetsUrl,
} as const;
