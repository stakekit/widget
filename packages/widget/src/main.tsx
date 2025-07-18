import ReactDOM from "react-dom/client";
import { SKApp, type SKAppProps } from "./App";
import {
  rootClassName,
  toggleThemeButtonClassName,
  toggleThemeButtonContainerClassName,
} from "./standalone.css";
import "./standalone.css";
import { useLayoutEffect, useState } from "react";
import { darkTheme, lightTheme } from "./styles/theme/themes";

const variant: SKAppProps["variant"] =
  import.meta.env.VITE_APP_VARIANT ?? "default";

const dashboardVariant: SKAppProps["dashboardVariant"] =
  import.meta.env.VITE_FORCE_DASHBOARD === "true";

const StandaloneApp = () => {
  const [themeVariant, setThemeVariant] = useState<"dark" | "light">("dark");

  useLayoutEffect(() => {
    document.body.className = rootClassName({ theme: themeVariant, variant });
  }, [themeVariant]);

  const toggleTheme = () =>
    setThemeVariant(themeVariant === "dark" ? "light" : "dark");

  return (
    <>
      <div className={toggleThemeButtonContainerClassName}>
        <button
          className={toggleThemeButtonClassName({ theme: themeVariant })}
          onClick={toggleTheme}
          type="button"
        >
          Toggle Theme
        </button>
      </div>

      <SKApp
        theme={themeVariant === "dark" ? darkTheme : lightTheme}
        apiKey={import.meta.env.VITE_API_KEY}
        onMountAnimationComplete={() =>
          console.log("mount animation complete!")
        }
        wagmi={{
          forceWalletConnectOnly:
            import.meta.env.VITE_FORCE_WALLET_CONNECT_ONLY === "true",
        }}
        {...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
          tracking: { trackEvent: console.log, trackPageView: console.log },
        })}
        dashboardVariant={dashboardVariant}
        variant={variant}
        // hideAccountAndChainSelector
      />
    </>
  );
};

const enableMocking = async () => {
  if (import.meta.env.VITE_ENABLE_MSW_MOCK !== "true") return;

  const { worker } = await import("./worker");

  return worker.start();
};

enableMocking()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <StandaloneApp />
    );
  })
  .catch((e) => {
    console.error(e);
  });
