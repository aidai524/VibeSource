import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 12h15M14 6l6 6-6 6" />
    </svg>
  );
}
export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m6.5 12.5 3.4 3.4 7.7-8" />
    </svg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="m11 9-7 7 7 7M21 9l7 7-7 7M19 5l-6 22" />
    </svg>
  );
}

export function RunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="m11.5 7.5 13 8.5-13 8.5v-17Z" />
    </svg>
  );
}

export function ProvenanceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <ellipse cx="16" cy="7.5" rx="9" ry="4.5" />
      <path d="M7 7.5v8c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-8M7 15.5v8c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-8" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3" />
    </svg>
  );
}
