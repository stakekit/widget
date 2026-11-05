/**
 * The SVG markup of every icon the Widget renders, drawn in `currentColor` so
 * the icon takes its tone from `Icon`. Only the Design System holds SVG icon
 * markup; brand artwork lives in `../artwork/`.
 */
import type { ReactNode } from "react";

type Glyph = { readonly viewBox: string; readonly body: ReactNode };

export const glyphs = {
  /** Points down; `direction` turns it. */
  ArrowIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M8 3v10M8 13l-4.5-4.5M8 13l4.5-4.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  ArrowsLeftRightIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="m11 9 2 2-2 2M3 11h10M5 7 3 5l2-2M13 5H3"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  CaretDownIcon: {
    viewBox: "0 0 12 12",
    body: (
      <path
        d="M9.75 4.5L6 8.25L2.25 4.5"
        stroke="currentColor"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  CaretLeftIcon: {
    viewBox: "0 0 24 24",
    body: (
      <path
        d="M15 19.5 7.5 12 15 4.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  CheckCircleIcon: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <path
          d="M10.75 6.5 7.081 10 5.25 8.25"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  CheckIcon: {
    viewBox: "0 0 256 256",
    body: (
      <path
        d="m232.49 80.49-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183 215.51 63.51a12 12 0 0 1 17 17Z"
        fill="currentColor"
      />
    ),
  },
  CopyIcon: {
    viewBox: "0 0 256 256",
    body: (
      <path
        d="M216 28H88a12 12 0 0 0-12 12v36H40a12 12 0 0 0-12 12v128a12 12 0 0 0 12 12h128a12 12 0 0 0 12-12v-36h36a12 12 0 0 0 12-12V40a12 12 0 0 0-12-12Zm-60 176H52V100h104Zm48-48h-24V88a12 12 0 0 0-12-12h-68V52h104Z"
        fill="currentColor"
      />
    ),
  },
  DisconnectIcon: {
    viewBox: "0 0 18 16",
    body: (
      <path
        d="M2.67834 15.5908H9.99963C11.5514 15.5908 12.399 14.7432 12.399 13.1777V10.2656H10.6354V12.9863C10.6354 13.5332 10.3688 13.8271 9.78772 13.8271H2.89026C2.3092 13.8271 2.0426 13.5332 2.0426 12.9863V3.15625C2.0426 2.60254 2.3092 2.30859 2.89026 2.30859H9.78772C10.3688 2.30859 10.6354 2.60254 10.6354 3.15625V5.89746H12.399V2.95801C12.399 1.39941 11.5514 0.544922 9.99963 0.544922H2.67834C1.12659 0.544922 0.278931 1.39941 0.278931 2.95801V13.1777C0.278931 14.7432 1.12659 15.5908 2.67834 15.5908ZM7.43616 8.85059H14.0875L15.0924 8.78906L14.566 9.14453L13.6842 9.96484C13.5406 10.1016 13.4586 10.2861 13.4586 10.4844C13.4586 10.8398 13.7321 11.168 14.1217 11.168C14.3199 11.168 14.4635 11.0928 14.6002 10.9561L16.7809 8.68652C16.986 8.48145 17.0543 8.27637 17.0543 8.06445C17.0543 7.85254 16.986 7.64746 16.7809 7.43555L14.6002 5.17285C14.4635 5.03613 14.3199 4.9541 14.1217 4.9541C13.7321 4.9541 13.4586 5.27539 13.4586 5.6377C13.4586 5.83594 13.5406 6.02734 13.6842 6.15723L14.566 6.98438L15.0924 7.33984L14.0875 7.27148H7.43616C7.01917 7.27148 6.65686 7.62012 6.65686 8.06445C6.65686 8.50195 7.01917 8.85059 7.43616 8.85059Z"
        fill="currentColor"
      />
    ),
  },
  DisconnectSquareIcon: {
    viewBox: "0 0 28 28",
    body: (
      <path
        d="M6.742 22.195h8.367c1.774 0 2.743-.968 2.743-2.758V16.11h-2.016v3.11c0 .625-.305.96-.969.96H6.984c-.664 0-.968-.335-.968-.96V7.984c0-.632.304-.968.968-.968h7.883c.664 0 .969.336.969.968v3.133h2.016v-3.36c0-1.78-.97-2.757-2.743-2.757H6.742C4.97 5 4 5.977 4 7.758v11.68c0 1.789.969 2.757 2.742 2.757Zm5.438-7.703h7.601l1.149-.07-.602.406-1.008.938a.816.816 0 0 0-.258.593c0 .407.313.782.758.782.227 0 .39-.086.547-.243l2.492-2.593c.235-.235.313-.47.313-.711 0-.242-.078-.477-.313-.719l-2.492-2.586c-.156-.156-.32-.25-.547-.25-.445 0-.758.367-.758.781 0 .227.094.446.258.594l1.008.945.602.407-1.149-.079H12.18a.904.904 0 0 0 0 1.805Z"
        fill="currentColor"
      />
    ),
  },
  ExternalLinkIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5v3a.5.5 0 0 1-.5.5H3.5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5h3"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  GiftIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M13.5 5h-11a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5ZM13 8v4.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V8M8 5v8M10.831 4.294C10.12 5 8 5 8 5s0-2.119.706-2.831a1.503 1.503 0 0 1 2.125 2.125ZM5.169 4.294C5.88 5 7.999 5 7.999 5s0-2.119-.705-2.831a1.503 1.503 0 0 0-2.125 2.125Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  /** The globe, such as for a region or a network. */
  GlobeIcon: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <circle cx={8} cy={8} r={6} stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M2 8h12M8 2c1.6 1.7 2.4 3.7 2.4 6s-.8 4.3-2.4 6c-1.6-1.7-2.4-3.7-2.4-6S6.4 3.7 8 2Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  HelpIcon: {
    viewBox: "4 4 24 24",
    body: (
      <>
        <path
          d="M16 25a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 22a1.125 1.125 0 1 0 0-2.25A1.125 1.125 0 0 0 16 22Z"
          fill="currentColor"
        />
        <path
          d="M16 17.5v-.75a2.625 2.625 0 1 0-2.625-2.625"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  HistoryIcon: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <path
          d="M8 5v3M10.6 9.5 8 8M11.513 6.231h2.5v-2.5"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.888 11.887a5.5 5.5 0 1 1 0-7.775l2.125 2.12"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  InfoIcon: {
    viewBox: "0 0 256 256",
    body: (
      <path
        d="M108 84a16 16 0 1 1 16 16 16 16 0 0 1-16-16Zm128 44A108 108 0 1 1 128 20a108.12 108.12 0 0 1 108 108Zm-24 0a84 84 0 1 0-84 84 84.09 84.09 0 0 0 84-84Zm-72 36.68V132a20 20 0 0 0-20-20 12 12 0 0 0-4 23.32V168a20 20 0 0 0 20 20 12 12 0 0 0 4-23.32Z"
        fill="currentColor"
      />
    ),
  },
  /** Stacked layers, such as for a list of positions. */
  LayersIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="m8 2 6 3.25L8 8.5 2 5.25 8 2ZM2 8l6 3.25L14 8M2 10.75 8 14l6-3.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  MinusIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M3 8h10"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  /** A pen, such as for signing a message. */
  PenIcon: {
    viewBox: "0 0 24 24",
    body: (
      <path
        d="M12 20h9M16.376 3.622a2.12 2.12 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854L16.376 3.622Z"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  PlusIcon: {
    viewBox: "0 0 24 24",
    body: (
      <path
        d="M12 2.454v19.092M2.454 12h19.092"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  PreferredIcon: {
    viewBox: "0 0 16 16",
    body: (
      <path
        d="M14.116 6.426c-.235-.246-.48-.5-.571-.723-.085-.204-.09-.543-.095-.871-.01-.61-.02-1.301-.5-1.782-.48-.48-1.172-.49-1.782-.5-.328-.005-.667-.01-.871-.095-.223-.092-.477-.336-.723-.571C9.143 1.469 8.653 1 8 1c-.652 0-1.142.47-1.574.884-.246.235-.5.48-.723.571-.203.085-.543.09-.871.095-.61.01-1.301.02-1.782.5-.48.48-.487 1.172-.5 1.782-.005.328-.01.667-.095.871-.092.223-.336.477-.571.723C1.469 6.857 1 7.347 1 8c0 .652.47 1.142.884 1.574.235.246.48.5.571.723.085.204.09.543.095.871.01.61.02 1.301.5 1.782.48.48 1.172.49 1.782.5.328.005.667.01.871.095.223.092.477.336.723.571.431.415.921.884 1.574.884.652 0 1.142-.47 1.574-.884.246-.235.5-.48.723-.571.204-.085.543-.09.871-.095.61-.01 1.301-.02 1.782-.5.48-.48.49-1.172.5-1.782.005-.328.01-.667.095-.871.092-.223.336-.477.571-.723C14.531 9.143 15 8.653 15 8c0-.652-.47-1.142-.884-1.574Zm-3.262.428-3.5 3.5a.502.502 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 9.293l3.146-3.147a.501.501 0 0 1 .708.708Z"
        fill="currentColor"
      />
    ),
  },
  SearchIcon: {
    viewBox: "0 0 14 14",
    body: (
      <path
        d="M13.5307 12.4693L10.5625 9.49998C11.4525 8.34027 11.868 6.88547 11.7247 5.43069C11.5815 3.97591 10.8902 2.63008 9.79119 1.66622C8.69215 0.702356 7.26764 0.192633 5.8066 0.24045C4.34557 0.288266 2.95742 0.890041 1.92376 1.9237C0.890102 2.95736 0.288327 4.34551 0.240511 5.80654C0.192694 7.26757 0.702417 8.69209 1.66628 9.79113C2.63014 10.8902 3.97597 11.5814 5.43075 11.7247C6.88553 11.8679 8.34033 11.4524 9.50004 10.5625L12.4707 13.5337C12.5404 13.6035 12.6232 13.6588 12.7144 13.6966C12.8056 13.7343 12.9032 13.7538 13.0019 13.7538C13.1006 13.7538 13.1983 13.7343 13.2894 13.6966C13.3806 13.6588 13.4634 13.6035 13.5332 13.5337C13.6029 13.464 13.6583 13.3811 13.696 13.29C13.7338 13.1988 13.7532 13.1011 13.7532 13.0025C13.7532 12.9038 13.7338 12.8061 13.696 12.715C13.6583 12.6238 13.6029 12.541 13.5332 12.4712L13.5307 12.4693ZM1.75004 5.99998C1.75004 5.15941 1.99929 4.33771 2.46629 3.6388C2.93329 2.93989 3.59705 2.39516 4.37363 2.07349C5.15022 1.75182 6.00475 1.66765 6.82917 1.83164C7.65359 1.99563 8.41087 2.4004 9.00524 2.99477C9.59961 3.58914 10.0044 4.34642 10.1684 5.17084C10.3324 5.99526 10.2482 6.84979 9.92652 7.62638C9.60485 8.40297 9.06012 9.06672 8.36121 9.53372C7.6623 10.0007 6.84061 10.25 6.00004 10.25C4.87322 10.2488 3.79289 9.80068 2.99611 9.0039C2.19933 8.20712 1.75119 7.12679 1.75004 5.99998Z"
        fill="currentColor"
      />
    ),
  },
  /** A wallet, such as for a step waiting for the wallet's signature. */
  WalletIcon: {
    viewBox: "0 0 16 16",
    body: (
      <>
        <path
          d="M11.5 5V3.75a.75.75 0 0 0-.75-.75h-7A1.25 1.25 0 0 0 2.5 4.25M2.5 4.25A1.25 1.25 0 0 0 3.75 5.5h8.5a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-.75.75h-8.5a1.25 1.25 0 0 1-1.25-1.25v-7.5Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={10.25} cy={9.25} r={0.875} fill="currentColor" />
      </>
    ),
  },
  WarningIcon: {
    viewBox: "0 0 17 17",
    body: (
      <>
        <path
          d="M7.574 2.021a1.25 1.25 0 0 1 2.165 0l5.9 10.219a1.25 1.25 0 0 1-1.083 1.875h-11.8a1.25 1.25 0 0 1-1.082-1.875l5.9-10.219Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.656 5.154v3.708"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={8.656} cy={11.325} r={0.924} fill="currentColor" />
      </>
    ),
  },
  /** A wrench, such as for maintenance. */
  WrenchIcon: {
    viewBox: "0 0 24 24",
    body: (
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  XIcon: {
    viewBox: "0 0 24 24",
    body: (
      <path
        d="m18.75 5.25-13.5 13.5M18.75 18.75 5.25 5.25"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
} satisfies Record<`${string}Icon`, Glyph>;

/** Every icon the Design System draws. */
export type IconName = keyof typeof glyphs;

/**
 * An icon drawn one way only: every icon but `ArrowIcon`, which needs a
 * direction. Parts that show an icon by name alone take these.
 */
export type FixedIconName = Exclude<IconName, "ArrowIcon">;
