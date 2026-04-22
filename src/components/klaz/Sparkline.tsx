// Tiny single-line SVG sparkline. Used in KPI cards and class table rows
// to give a glanceable sense of trend without a full chart library.

export function Sparkline({
  values,
  stroke = "currentColor",
  w = 60,
  h = 18,
  strokeWidth = 1.25,
  className,
}: {
  values: number[]
  stroke?: string
  w?: number
  h?: number
  strokeWidth?: number
  className?: string
}) {
  if (!values || values.length === 0) {
    return <svg width={w} height={h} className={className} />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
