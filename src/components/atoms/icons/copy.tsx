export const Copy = ({
  hw = 24,
  className,
}: {
  hw?: number;
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={hw}
    height={hw}
    fill="#909090"
    viewBox="0 0 256 256"
    className={className}
  >
    <path d="M216 28H88a12 12 0 0 0-12 12v36H40a12 12 0 0 0-12 12v128a12 12 0 0 0 12 12h128a12 12 0 0 0 12-12v-36h36a12 12 0 0 0 12-12V40a12 12 0 0 0-12-12Zm-60 176H52V100h104Zm48-48h-24V88a12 12 0 0 0-12-12h-68V52h104Z" />
  </svg>
);
