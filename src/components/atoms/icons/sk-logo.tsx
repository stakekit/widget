export const SKLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={17} height={16} fill="none">
    <g clipPath="url(#a)" filter="url(#b)">
      <path
        fill="url(#c)"
        d="M13.573 6.92c.028-2.343.043-3.515-.703-4.17-.747-.657-1.905-.491-4.222-.16l-3.065.439a1.142 1.142 0 1 0 .395 2.248l1.952-.405c.702-.146 1.053-.218 1.205-.126.14.086.223.24.216.405-.008.178-.264.429-.776.93L6.787 7.834c-.423.414-.634.621-.737.804-.375.671-.169 1.52.474 1.943.175.116.458.203 1.024.377.177.054.265.081.32.117.198.132.26.396.14.603-.032.056-.1.12-.234.246l-1.93 1.825a1.232 1.232 0 1 0 1.814 1.654l2.104-2.696c.645-.826.967-1.239.944-1.659a1.122 1.122 0 0 0-.12-.444c-.189-.375-.675-.573-1.646-.967-.344-.14-.516-.21-.576-.34a.361.361 0 0 1-.032-.153c0-.144.13-.278.387-.545l1.604-1.665c.413-.428.619-.642.779-.662a.456.456 0 0 1 .44.207c.086.135.054.431-.01 1.022l-.218 1.996a1.115 1.115 0 1 0 2.226.137l.033-2.714Z"
      />
    </g>
    <defs>
      <linearGradient
        id="c"
        x1={11.651}
        x2={4.464}
        y1={2.55}
        y2={16.736}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset={0.052} stopColor="#FFC21B" />
        <stop offset={0.234} stopColor="#B1A5B9" />
        <stop offset={0.385} stopColor="#F46FC8" />
        <stop offset={0.797} stopColor="#FF5F25" />
        <stop offset={1} stopColor="#6D05F3" />
      </linearGradient>
      <clipPath id="a">
        <path fill="#fff" d="M.935.975h16v15h-16z" />
      </clipPath>
      <filter
        id="b"
        width={8.977}
        height={13.756}
        x={4.605}
        y={2.3}
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset dy={0.18} />
        <feGaussianBlur stdDeviation={0.51} />
        <feComposite in2="hardAlpha" k2={-1} k3={1} operator="arithmetic" />
        <feColorMatrix values="0 0 0 0 0.98 0 0 0 0 1 0 0 0 0 0 0 0 0 0.3 0" />
        <feBlend in2="shape" result="effect1_innerShadow_1687_4078" />
      </filter>
    </defs>
  </svg>
);
