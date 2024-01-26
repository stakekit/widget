export const config = {
  appName: "SteakKit",
  currency: "USD",
  queryClient: {
    staleTime: 1000 * 5,
    cacheTime: 1000 * 60 * 5,
  },
  walletConnectV2: {
    relayUrl: "wss://relay.walletconnect.com",
    projectId: "10a5257c04d1d3097ff768a139c95f50",
  },
  appPrefix: "sk-widget",
  env: {
    apiUrl: import.meta.env.VITE_API_URL,
    isTestMode: import.meta.env.MODE === "test",
    isDevMode: import.meta.env.DEV,
  },
  mswEnabled:
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW_MOCK === "true",
} as const;
