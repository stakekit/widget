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
  const [themeVariant, setThemeVariant] = useState<"dark" | "light">("light");

  useLayoutEffect(() => {
    document.body.className = rootClassName({ theme: themeVariant, variant });
  }, [themeVariant]);

  const toggleTheme = () =>
    setThemeVariant(themeVariant === "dark" ? "light" : "dark");

  const props: SKAppProps = {
    variant,
    dashboardVariant,
    theme: themeVariant === "dark" ? darkTheme : lightTheme,
    apiKey: import.meta.env.VITE_API_KEY,
    onMountAnimationComplete: () => console.log("mount animation complete!"),
    ...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
      tracking: { trackEvent: console.log, trackPageView: console.log },
    }),
    ...(import.meta.env.VITE_FORCE_WALLET_CONNECT_ONLY === "true" && {
      wagmi: {
        forceWalletConnectOnly: true,
      },
    }),
  };

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

      <SKApp {...props} />
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
