'use client'

import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn, severityBg, severityColor, severityLabel } from '@/lib/utils'

interface Props {
  aiSeverity: number | null
  userSeverity: number | null
  onChange: (value: number) => void
}

export default function SeverityMeter({ aiSeverity, userSeverity, onChange }: Props) {
  const displayed = userSeverity ?? aiSeverity ?? 5

  return (
    <div className="space-y-4">
      {aiSeverity !== null && (
        <div className={cn('rounded-lg border p-3 text-sm', severityBg(aiSeverity))}>
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-700">AI Assessment</span>
            <Badge variant="outline" className={cn('font-bold', severityColor(aiSeverity))}>
              {aiSeverity}/10 · {severityLabel(aiSeverity)}
            </Badge>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">
            {aiSeverity !== null && userSeverity !== null ? 'Your override' : 'Severity rating'}
          </span>
          <Badge variant="outline" className={cn('font-bold text-base px-3 py-1', severityColor(displayed))}>
            {displayed}/10 · {severityLabel(displayed)}
          </Badge>
        </div>

        <Slider
          min={1}
          max={10}
          step={1}
          value={[displayed]}
          onValueChange={([val]) => onChange(val)}
          className="w-full"
        />

        <div className="flex justify-between text-xs text-neutral-400">
          <span>Clear (1)</span>
          <span>Moderate (5)</span>
          <span>Severe (10)</span>
        </div>
      </div>
    </div>
  )
}
