# StakeKit Widget

StakeKit Widget is a component that you can embed in your website with few lines of code. It allows your users to stake their crypto assets and earn rewards.

StakeKit Widget is mainly built as a React component and can be easily added in your application by importing it. There is also an option to use fully bundled widget component which can be added in any javascript library. If your application is already using React, using it as a React component will reduce bundle size of your application. If not, there is option for fully bundled component.

## Development

Create `.env.development.local` file and add variables from `.env.example`. For production builds, add `.env.production.local` file

## Installation

To install StakeKit Widget:

```bash
npm install @stakekit/widget

yarn add @stakekit/widget

pnpm add @stakekit/widget
```

## Usage

To use StakeKit Widget, first you'll need API key from StakeKit.

## React component usage

After you get the API key, you can import styles and widget component:

```tsx
import "@stakekit/widget/package/css";
import { SKApp, darkTheme } from "@stakekit/widget";

const App = () => {
  return <SKApp apiKey="your-api-key" theme={darkTheme} />;
};
```

## Bundled component usage

```ts
import "@stakekit/widget/bundle/css";
import { renderSKWidget, lightTheme, darkTheme } from "@stakekit/widget/bundle";

const { rerender } = renderSKWidget({
  container: document.getElementById("sk_widget_container")!,
  apiKey: "your-api-key",
  theme: lightTheme,
});

rerender({
  apiKey: "your-api-key",
  theme: darkTheme,
}) // pass new props here
```

## Params

To open the widget on a specific yield opportunity you need to pass the parameter yieldId as a prop to the component. Below is are examples that will open the widget on theethereum-eth-lido-staking. All possible yieldIds can be retrieved from the /v1/stake/opportunities endpoint

### React component

```tsx
import "@stakekit/widget/package/css";
import { SKApp, darkTheme } from "@stakekit/widget";

const App = () => {
  return (
    <SKApp
      apiKey="your-api-key"
      theme={darkTheme}
      yieldId="ethereum-eth-lido-staking"
    />
  );
};
```

### Options

```tsx
type SettingsProps = {
  apiKey: string;
  theme?: ThemeWrapperTheme;
  tracking?: {
    trackEvent?: (event: TrackEventVal, properties?: Properties) => void;
    trackPageView?: (page: TrackPageVal, properties?: Properties) => void;
  };
  onMountAnimationComplete?: () => void;
  externalProviders?: SKExternalProviders;
  disableGasCheck?: boolean;
  hideNetworkLogo?: boolean;
  disableInitLayoutAnimation?: boolean;
  disableResizingInputFontSize?: boolean;
  disableAutoScrollToTop?: boolean;
  language?: Languages;
  customTranslations?: RecursivePartial<typeof localResources>;
  tokensForEnabledYieldsOnly?: boolean;
  preferredTransactionFormat?: TransactionFormat;
  hideChainModal?: boolean;
  whitelistedValidatorAddresses?: string[];
  tokenIconMapping?:
    | Record<TokenDto["symbol"], string>
    | ((token: TokenDto) => string);
  chainIconMapping?:
    | Record<SupportedSKChains, string>
    | ((chain: SupportedSKChains) => string);
};
```

### Override Icons

You can override token or chain icons in widget

```tsx
tokenIconMapping?:
  | Record<TokenDto["symbol"], string>
  | ((token: TokenDto) => string);
chainIconMapping?:
  | Record<SupportedSKChains, string>
  | ((chain: SupportedSKChains) => string);
```

After this is done, you can start using the widget.

## Style customization

You can customize look of widget by overriding `darkTheme` or `lightTheme`, or providing your own theme and passing it to StakeKit. If theme is not provided, widget will use default `lightTheme`.

```tsx
import "@stakekit/widget/package/css";
import { SKApp } from "@stakekit/widget";

const App = () => {
  return (
    <SKApp
      apiKey="your-api-key"
      theme={{
        lightMode: {
          font: { body: '"IBM Plex Mono", monospace' },
          color: {
            primaryButtonBackground: "#8323fd",
            primaryButtonActiveOutline: "#8323fd",
            primaryButtonOutline: "#8323fd",
          },
          borderRadius: { primaryButton: "0", widgetBorderRadius: "10px" },
        },
      }}
    />
  );
};
```

```tsx
import "@stakekit/widget/package/css";
import { SKApp, darkTheme } from "@stakekit/widget";

const App = () => {
  return (
    <SKApp
      apiKey="your-api-key"
      theme={{
        ...darkTheme,
        borderRadius: { ...darkTheme.borderRadius, widgetBorderRadius: "10px" },
      }}
    />
  );
};
```

You can also provide both themes, and widget will respect preference if a user has requested light or dark color themes

```tsx
import "@stakekit/widget/package/css";
import { SKApp, darkTheme, lightTheme } from "@stakekit/widget";

const App = () => {
  return (
    <SKApp
      apiKey="your-api-key"
      theme={{
        lightMode: lightTheme,
        darkMode: darkTheme,
      }}
    />
  );
};
```

#### Theme properties:

```ts
{
  color: {
      white: string;
      black: string;
      transparent: string;
      primary: string;
      accent: string;
      disabled: string;
      text: string;
      textMuted: string;
      textDanger: string;
      background: string;
      backgroundMuted: string;
      tokenSelectBackground: string;
      tokenSelectHoverBackground: string;
      tokenSelect: string;
      skeletonLoaderBase: string;
      skeletonLoaderHighlight: string;
      tabBorder: string;
      stakeSectionBackground: string;
      dropdownBackground: string;
      selectValidatorMultiSelectedBackground: string;
      selectValidatorMultiDefaultBackground: string;
      warningBoxBackground: string;
      positionsSectionBackgroundColor: string;
      positionsSectionBorderColor: string;
      positionsSectionDividerColor: string;
      positionsClaimRewardsBackground: string;
      positionsActionRequiredBackground: string;
      positionsPendingBackground: string;
      modalOverlayBackground: string;
      modalBodyBackground: string;
      tooltipBackground: string;
      primaryButtonColor: string;
      primaryButtonBackground: string;
      primaryButtonOutline: string;
      primaryButtonHoverColor: string;
      primaryButtonHoverBackground: string;
      primaryButtonHoverOutline: string;
      primaryButtonActiveColor: string;
      primaryButtonActiveBackground: string;
      primaryButtonActiveOutline: string;
      secondaryButtonColor: string;
      secondaryButtonBackground: string;
      secondaryButtonOutline: string;
      secondaryButtonHoverColor: string;
      secondaryButtonHoverBackground: string;
      secondaryButtonHoverOutline: string;
      secondaryButtonActiveColor: string;
      secondaryButtonActiveBackground: string;
      secondaryButtonActiveOutline: string;
      smallButtonColor: string;
      smallButtonBackground: string;
      smallButtonOutline: string;
      smallButtonHoverColor: string;
      smallButtonHoverBackground: string;
      smallButtonHoverOutline: string;
      smallButtonActiveColor: string;
      smallButtonActiveBackground: string;
      smallButtonActiveOutline: string;
      smallLightButtonColor: string;
      smallLightButtonBackground: string;
      smallLightButtonOutline: string;
      smallLightButtonHoverColor: string;
      smallLightButtonHoverBackground: string;
      smallLightButtonHoverOutline: string;
      smallLightButtonActiveColor: string;
      smallLightButtonActiveBackground: string;
      smallLightButtonActiveOutline: string;
      disabledButtonColor: string;
      disabledButtonBackground: string;
      disabledButtonOutline: string;
      disabledButtonHoverColor: string;
      disabledButtonHoverBackground: string;
      disabledButtonHoverOutline: string;
      disabledButtonActiveColor: string;
      disabledButtonActiveBackground: string;
      disabledButtonActiveOutline: string;
  } & {
      connectKit: {
            accentColor: string;
            accentColorForeground: string;
            actionButtonBorder: string;
            actionButtonBorderMobile: string;
            actionButtonSecondaryBackground: string;
            closeButton: string;
            closeButtonBackground: string;
            connectButtonBackground: string;
            connectButtonBackgroundError: string;
            connectButtonInnerBackground: string;
            connectButtonText: string;
            connectButtonTextError: string;
            connectionIndicator: string;
            downloadBottomCardBackground: string;
            downloadTopCardBackground: string;
            error: string;
            generalBorder: string;
            generalBorderDim: string;
            menuItemBackground: string;
            modalBackdrop: string;
            modalBackground: string;
            modalBorder: string;
            modalText: string;
            modalTextDim: string;
            modalTextSecondary: string;
            profileAction: string;
            profileActionHover: string;
            profileForeground: string;
            selectedOptionBorder: string;
            standby: string;
        };
  };
  fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      lgx: string;
      xl: string;
      "2xl": string;
      "3xl": string;
      "4xl": string;
      "5xl": string;
      "6xl": string;
  };
  letterSpacing: {
      tighter: string;
      tight: string;
      normal: string;
      wide: string;
      wider: string;
      widest: string;
  };
  lineHeight: {
      none: string;
      shorter: string;
      short: string;
      base: string;
      tall: string;
      taller: string;
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      "2xl": string;
      "3xl": string;
      "4xl": string;
      "5xl": string;
      "6xl": string;
  };
  fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
      extrabold: string;
      modalHeading: string;
      tokenSelect: string;
      primaryButton: string;
      secondaryButton: string;
  };
  borderRadius: {
      baseContract: {
          none: string;
          sm: string;
          base: string;
          md: string;
          lg: string;
          xl: string;
          "2xl": string;
          "3xl": string;
          full: string;
          half: string;
          widgetBorderRadius: string;
          primaryButton: string;
          secondaryButton: string;
          smallButton: string;
      };
      connectKit: {
            actionButton: string;
            connectButton: string;
            menuButton: string;
            modal: string;
            modalMobile: string;
        };
  };
  space: {
      full: string;
      unset: string;
      auto: string;
      "0": string;
      "1": string;
      "2": string;
      "3": string;
      "4": string;
      "5": string;
      "6": string;
      "7": string;
      "8": string;
      "9": string;
      "10": string;
      "12": string;
      "14": string;
      "16": string;
      "20": string;
      "24": string;
      "28": string;
      "32": string;
      "36": string;
      "40": string;
      "44": string;
      "48": string;
      px: string;
      buttonMinHeight: string;
  };
  heading: {
      h1: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
      h2: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
      h3: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
      h4: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
  };
  text: {
      small: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
      large: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
      medium: {
          mobile: {
              fontSize: string;
          };
          tablet: {
              fontSize: string;
          };
      };
  };
  zIndices: {
      hide: string;
      auto: string;
      simple: string;
      base: string;
      docked: string;
      dropdown: string;
      sticky: string;
      banner: string;
      overlay: string;
      modal: string;
      skipLink: string;
  };
  font: {
      body: string;
  };
}
```

### Custom provider

Optionally, you can pass externalProviders property to the widget which will be used to connect to the wallet.

```ts
 type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: `${TokenDto["network"]}-${TokenDto["address"]}`;
  supportedChainIds?: SupportedSKChainIds[];
  type: "generic";
  provider: SKWallet;
};

type SupportedSKChainIds =
  | EvmChainIds
  | SubstrateChainIds
  | MiscChainIds;

enum EvmChainIds {
  Ethereum = 1,
  Polygon = 137,
  Optimism = 10,
  Arbitrum = 42_161,
  AvalancheC = 43_114,
  Celo = 42_220,
  Harmony = 1_666_600_000,
  Viction = 88,
  Binance = 56,
  Base = 8453,
  Linea = 59_144,
  Core = 1116,
  Sonic = 146,
  EthereumHolesky = 17000,
  EthereumGoerli = 5,
}

enum SubstrateChainIds {
  Polkadot = 9999,
}

enum MiscChainIds {
  Near = 397,
  Tezos = 1729,
  Solana = 501,
  Tron = 79,
  Ton = 3412,
}

type EVMTx = {
  type: "evm";
  tx: DecodedEVMTransaction;
};

type SolanaTx = {
  type: "solana";
  tx: DecodedSolanaTransaction;
};

type TonTx = {
  type: "ton";
  tx: DecodedTonTransaction;
};

type TronTx = {
  type: "tron";
  tx: DecodedTronTransaction;
};

type SKTx = EVMTx | SolanaTx | TonTx | TronTx;

type ActionMeta = {
  actionId: ActionDto["id"];
  actionType: ActionDto["type"];
  amount: ActionDto["amount"];
  inputToken: ActionDto["inputToken"];
  providersDetails: {
    name: string;
    address: string | undefined;
    rewardRate: number | undefined;
    rewardType: RewardTypes;
    website: string | undefined;
    logo: string | undefined;
  }[];
};

type SKTxMeta = ActionMeta & {
  txId: TransactionDto["id"];
  txType: TransactionDto["type"];
};

type SKWallet = {
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(
    tx: SKTx,
    txMeta: SKTxMeta
  ): Promise<
    | string
    | { type: "success"; txHash: string }
    | { type: "error"; error: string }
  >;
};
```

### Tracking

StakeKit component provides `tracking` prop for analytics to track user actions and page views

```tsx
import "@stakekit/widget/package/css";
import { SKApp, darkTheme, lightTheme } from "@stakekit/widget";

const App = () => {
  return (
    <SKApp
      apiKey="your-api-key"
      theme={{ darkMode: darkTheme }}
      tracking={{
        trackEvent: (event, props) => {
          console.log(event, props);
        },
        trackPageView: (event, props) => {
          console.log(event, props);
        },
      }}
    />
  );
};
```

## React Native wallets usage

To use StakeKit with your wallets managed provider, you can use utility hook to get prepared props and pass them to `WebView` component from `react-native-webview`. Using widget with injected provider skips connection step.

First, install package:

```bash
npm install @stakekit/use-inject-provider
```

or

```bash
yarn add @stakekit/use-inject-provider
```

or

```bash
pnpm add @stakekit/use-inject-provider
```

After that, pass wallets managed EIP-1193 provider and web-views ref to `useInjectProvider`, and you'll receive `injectedJavaScript` and `onMessage` props that you need to pass to `WebView` component.

Example:

```tsx
import React, { useRef } from "react";
import { StyleSheet } from "react-native";
import WebView from "react-native-webview";
import { useInjectProvider } from "@stakekit/use-inject-provider";

// Some EIP1193Provider thats managed by wallet
class Provider {
  async request(args) {
    switch (args.method) {
      case "eth_accounts":
      case "eth_requestAccounts": {
        // get accounts from your wallet
        // ...
        return ["0xe455036e2f3a26df7014b7dbf6cedbbf81433478"];
      }

      case "eth_chainId": {
        // get current chain id
        return "1";
      }

      case "eth_sendTransaction": {
        // send transaction and return transaction hash
        // ...
        return "some_transaction_hash";
      }

      default:
        throw new Error("unhandled method");
    }
  }
}

const provider = new Provider();

export const WebViewStake = () => {
  const webViewRef = useRef<WebView>(null);

  const { injectedJavaScript, onMessage } = useInjectProvider({
    webViewRef,
    provider,
  });

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: `${WIDGET_URL}/?api_key=${YOUR_API_KEY}` }}
      onMessage={onMessage}
      injectedJavaScript={injectedJavaScript}
      style={styles.container}
      cacheEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```
