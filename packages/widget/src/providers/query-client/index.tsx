import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";

/** Third-party infrastructure for Wagmi/RainbowKit; widget API state is forbidden here. */
export const ThirdPartyQueryClientProvider = ({
  children,
}: PropsWithChildren) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
