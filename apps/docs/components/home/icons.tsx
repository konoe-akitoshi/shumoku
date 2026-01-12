import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

export function LayoutIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  )
}

export function CodeIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  )
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

export function NetBoxIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 366 366" aria-hidden="true" {...props}>
      <path
        d="M337.27,228.59c-12.35,0-22.88,7.8-26.94,18.74H135.62c-2.9-7.83-9.12-14.04-16.95-16.95V55.67c10.94-4.06,18.74-14.59,18.74-26.94,0-15.87-12.86-28.73-28.73-28.73s-28.73,12.86-28.73,28.73c0,12.35,7.8,22.88,18.74,26.94v174.71c-10.94,4.06-18.74,14.59-18.74,26.94,0,4.28.94,8.33,2.62,11.98l-41.85,41.85c-3.65-1.68-7.7-2.62-11.98-2.62C12.87,308.53.01,321.39.01,337.26s12.86,28.73,28.73,28.73,28.73-12.86,28.73-28.73c0-4.28-.94-8.33-2.62-11.98l41.85-41.85c3.65,1.68,7.7,2.62,11.98,2.62,12.35,0,22.88-7.8,26.94-18.74h174.71c4.06,10.94,14.59,18.74,26.94,18.74,15.87,0,28.73-12.86,28.73-28.73s-12.86-28.73-28.73-28.73Z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M366,28.73c0,15.87-12.86,28.73-28.73,28.73-4.28,0-8.33-.94-11.98-2.62l-41.85,41.85c1.68,3.65,2.62,7.7,2.62,11.98,0,12.35-7.8,22.88-18.74,26.94v174.71c10.94,4.06,18.74,14.59,18.74,26.94,0,15.87-12.86,28.73-28.73,28.73s-28.73-12.86-28.73-28.73c0-12.35,7.8-22.88,18.74-26.94V135.62c-7.83-2.9-14.04-9.12-16.95-16.95H55.67c-4.06,10.94-14.59,18.74-26.94,18.74-15.87,0-28.73-12.86-28.73-28.73s12.86-28.73,28.73-28.73c12.35,0,22.88,7.8,26.94,18.74h174.71c4.06-10.94,14.59-18.74,26.94-18.74,4.28,0,8.33.94,11.98,2.62l41.85-41.85c-1.68-3.65-2.62-7.7-2.62-11.98C308.53,12.86,321.39,0,337.26,0s28.73,12.86,28.73,28.73Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  )
}
