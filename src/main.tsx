import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme } from "./styles";
import "./standalone.styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SKApp
    connectKitForceTheme="darkMode"
    theme={darkTheme}
    apiKey={import.meta.env.VITE_API_KEY}
    forceWalletConnectOnly={
      import.meta.env.VITE_FORCE_WALLET_CONNECT_ONLY === "true"
    }
    {...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
      tracking: { trackEvent: console.log, trackPageView: console.log },
    })}
  />
);
