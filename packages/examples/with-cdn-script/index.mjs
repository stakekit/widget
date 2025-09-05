import {
  darkTheme,
  renderSKWidget,
} from "https://unpkg.com/@stakekit/widget@0.0.248/dist/bundle/index.bundle.js";

const rootElement = document.getElementById("widget-container");

const shadowRoot = rootElement.attachShadow({ mode: "closed" });

const head = document.createElement("head");

const link = document.createElement("link");
link.rel = "stylesheet";
link.href =
  "https://unpkg.com/@stakekit/widget@0.0.248/dist/bundle/index.bundle.css";
head.appendChild(link);

shadowRoot.appendChild(head);
document.head.appendChild(link.cloneNode());

const shadowBody = document.createElement("body");
shadowRoot.appendChild(shadowBody);

const shadowContainer = document.createElement("div");
shadowContainer.style.all = "initial";
shadowRoot.appendChild(shadowContainer);

renderSKWidget({
  container: shadowContainer,
  theme: darkTheme,
  apiKey: "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
  portalContainer: shadowBody,
});

const observer = new MutationObserver(() => {
  const runtimeStyles = shadowContainer.querySelectorAll(
    '[data-rk="stakekit"] > style'
  );

  runtimeStyles.forEach((style) => {
    document.head.appendChild(style.cloneNode(true));
  });
});

observer.observe(shadowContainer, { childList: true });
