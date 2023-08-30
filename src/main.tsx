import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme } from "./styles";
import { config } from "./config";

document.getElementById("root")!.style.background = "#211F25";
document.body!.style.background = "#211F25";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SKApp
    apiKey={config.apiKey}
    connectKitForceTheme="darkMode"
    theme={darkTheme}
  />
);
