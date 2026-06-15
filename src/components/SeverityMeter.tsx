'use client'

const LEVELS = [
  { emoji: '😊', label: 'Clear', min: 1, max: 2, value: 1, bg: '#F0FDF4', border: '#16A34A', text: '#15803D' },
  { emoji: '🙂', label: 'Mild', min: 3, max: 4, value: 3, bg: '#F7FEE7', border: '#65A30D', text: '#4D7C0F' },
  { emoji: '😐', label: 'Moderate', min: 5, max: 6, value: 5, bg: '#FEFCE8', border: '#CA8A04', text: '#854D0E' },
  { emoji: '😣', label: 'Severe', min: 7, max: 8, value: 7, bg: '#FFF7ED', border: '#EA580C', text: '#9A3412' },
  { emoji: '😖', label: 'Very bad', min: 9, max: 10, value: 9, bg: '#FEF2F2', border: '#DC2626', text: '#991B1B' },
]

function bucketFor(n: number) {
  return LEVELS.find((l) => n >= l.min && n <= l.max) ?? LEVELS[2]
}

interface Props {
  aiSeverity: number | null
  userSeverity: number | null
  onChange: (value: number) => void
}

export default function SeverityMeter({ aiSeverity, userSeverity, onChange }: Props) {
  const current = userSeverity ?? aiSeverity
  const currentBucket = current !== null ? bucketFor(current) : null
  const aiBucket = aiSeverity !== null ? bucketFor(aiSeverity) : null
  const userOverrode = userSeverity !== null && aiBucket && currentBucket && aiBucket.value !== currentBucket.value

  return (
    <div className="space-y-2.5">
      {aiSeverity !== null && aiBucket ? (
        <p className="text-xs text-neutral-400">
          AI: <span style={{ color: aiBucket.text }}>{aiBucket.emoji} {aiBucket.label}</span>
          {userOverrode ? ' · you overrode this' : ' · tap to change'}
        </p>
      ) : (
        <p className="text-xs text-neutral-400">How's your skin today?</p>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((level) => {
          const isSelected = currentBucket?.value === level.value
          const isAIPick = aiBucket?.value === level.value && !isSelected
          return (
            <button
              key={level.value}
              onClick={() => onChange(level.value)}
              className="flex flex-col items-center justify-center rounded-xl py-3 gap-0.5 transition-all active:scale-95"
              style={{
                background: isSelected ? level.bg : '#F9FAFB',
                border: `1.5px solid ${isSelected ? level.border : '#E5E7EB'}`,
              }}
            >
              <span className="text-xl leading-none">{level.emoji}</span>
              <span
                className="text-[10px] font-medium leading-tight mt-0.5"
                style={{ color: isSelected ? level.text : '#9CA3AF' }}
              >
                {level.label}
              </span>
              {isAIPick && (
                <span className="text-[8px] font-medium" style={{ color: '#D1D5DB' }}>AI</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
