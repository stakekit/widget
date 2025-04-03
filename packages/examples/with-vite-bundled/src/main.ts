import "./style.css";
import "@stakekit/widget/style.css";
import { darkTheme, renderSKWidget } from "@stakekit/widget/bundle";

renderSKWidget({
  container: document.querySelector<HTMLDivElement>("#app")!,
  apiKey: import.meta.env.VITE_API_KEY,
  theme: darkTheme,
});
