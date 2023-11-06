import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme } from "./styles";
import { config } from "./config";
import "./standalone.styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SKApp
    apiKey={config.env.apiKey}
    connectKitForceTheme="darkMode"
    theme={darkTheme}
    forceWalletConnectOnly={config.env.forceWalletConnectOnly}
    {...(config.env.analyticsLogging && {
      tracking: { trackEvent: console.log, trackPageView: console.log },
    })}
  />
);
