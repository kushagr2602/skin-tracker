interface Props {
  size?: number
  className?: string
}

// The "lens + progress" mark: a camera ring holding a rising trend of dots,
// the latest reading emphasized. Tuned for light backgrounds (greens).
export default function Logo({ size = 32, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" className={className} aria-hidden="true">
      <g transform="translate(64,64)">
        <circle r="56" fill="none" stroke="#38B48B" strokeWidth="5" />
        <polyline points="-34,22 -12,6 12,-12 34,-30" fill="none" stroke="#2E9C77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="-34" cy="22" r="4.5" fill="#1F8F68" />
        <circle cx="-12" cy="6" r="4.5" fill="#1F8F68" />
        <circle cx="12" cy="-12" r="4.5" fill="#1F8F68" />
        <circle cx="34" cy="-30" r="6.5" fill="#38B48B" />
      </g>
    </svg>
  )
}
