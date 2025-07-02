import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SKApp } from "../../src/App";
import type { SettingsContextProvider } from "../../src/providers/settings";
import { VirtualizerObserveElementRectProvider } from "../../src/providers/virtual-scroll";

const renderApp = (opts?: {
  options?: RenderOptions;
  wagmi?: ComponentProps<typeof SettingsContextProvider>["wagmi"];
  skProps?: ComponentProps<typeof SKApp>;
}) => {
  const App = (
    <VirtualizerObserveElementRectProvider>
      <SKApp
        apiKey={import.meta.env.VITE_API_KEY}
        wagmi={opts?.wagmi}
        {...opts?.skProps}
      />
    </VirtualizerObserveElementRectProvider>
  );

  return render(App, opts?.options);
};

export * from "@testing-library/react";
export { renderApp };
