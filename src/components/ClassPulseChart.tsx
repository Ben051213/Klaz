"use client"

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TopicConfusion } from "@/lib/types"

function colorFor(percentage: number) {
  if (percentage > 60) return "#ef4444"
  if (percentage > 30) return "#f59e0b"
  return "#10b981"
}

export function ClassPulseChart({
  data,
  loading,
}: {
  data: TopicConfusion[]
  loading?: boolean
}) {
  if (loading && data.length === 0) {
    return (
      <div className="flex h-64 animate-pulse items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
        Loading pulse data…
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
        No confusion signals yet — session just started.
      </div>
    )
  }
  const chartData = data.slice(0, 8)
  const height = Math.max(240, chartData.length * 36)
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="topic"
            width={110}
            tick={{ fontSize: 12, fill: "#1e293b" }}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(value, _name, item) => {
              const p = (item as { payload?: TopicConfusion }).payload
              if (!p) return [String(value), ""]
              return [
                `${value}% confused (${p.confusedCount}/${p.totalMessages})`,
                p.topic,
              ]
            }}
          />
          <Bar dataKey="percentage" radius={[0, 6, 6, 0]}>
            {chartData.map((d) => (
              <Cell key={d.topic} fill={colorFor(d.percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
