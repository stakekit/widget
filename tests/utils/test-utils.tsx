import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { VirtuosoMockContext } from "react-virtuoso";
import { SKApp } from "../../src/App";
import type { SettingsContextProvider } from "../../src/providers/settings";

const renderApp = (opts?: {
  options?: RenderOptions;
  wagmi?: ComponentProps<typeof SettingsContextProvider>["wagmi"];
  referralCheck?: boolean;
  skProps?: ComponentProps<typeof SKApp>;
}) => {
  const App = (
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 800, itemHeight: 60 }}
    >
      <SKApp
        apiKey={import.meta.env.VITE_API_KEY}
        wagmi={opts?.wagmi}
        referralCheck={opts?.referralCheck}
        {...opts?.skProps}
      />
    </VirtuosoMockContext.Provider>
  );

  return render(App, opts?.options);
};

export * from "@testing-library/react";
export { renderApp };
