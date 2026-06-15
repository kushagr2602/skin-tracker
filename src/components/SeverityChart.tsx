'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface Props {
  data: Array<{ date: string; severity: number }>
}

export default function SeverityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[1, 10]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val) => [(val as number) + '/10', 'Severity']}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <ReferenceLine y={5} stroke="#e5e7eb" strokeDasharray="4 4" label={{ value: 'Moderate', position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
        <Line
          type="monotone"
          dataKey="severity"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3, fill: '#f97316' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
