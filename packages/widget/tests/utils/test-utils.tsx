import type { ComponentProps } from "react";
import { type RenderOptions, render } from "vitest-browser-react";
import { SKApp } from "../../src/App";
import type { SettingsProps } from "../../src/public-api/types";

const renderApp = (opts?: {
  options?: RenderOptions;
  wagmi?: SettingsProps["wagmi"];
  skProps?: ComponentProps<typeof SKApp>;
}) => {
  const App = (
    <SKApp
      apiKey={import.meta.env.VITE_API_KEY}
      wagmi={opts?.wagmi}
      {...opts?.skProps}
    />
  );

  return render(App, opts?.options);
};

export * from "vitest-browser-react";
export { renderApp };
