import { ComponentProps } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { SettingsContextProvider } from "../../src/providers/settings";
import { SKApp } from "../../src/App";

const renderApp = (opts?: {
  options?: RenderOptions;
  wagmi?: ComponentProps<typeof SettingsContextProvider>["wagmi"];
}) => {
  const App = (
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 800, itemHeight: 60 }}
    >
      <SKApp apiKey={import.meta.env.VITE_API_KEY} wagmi={opts?.wagmi} />
    </VirtuosoMockContext.Provider>
  );

  return render(App, opts?.options);
};

export * from "@testing-library/react";
export { renderApp };
