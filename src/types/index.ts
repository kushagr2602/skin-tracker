export type SeverityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'meal'

export type Frequency =
  | 'morning'
  | 'evening'
  | 'morning_and_evening'
  | 'once_daily'
  | 'twice_daily'
  | 'weekly'
  | 'as_needed'

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  morning: 'Morning',
  evening: 'Evening',
  morning_and_evening: 'AM & PM',
  once_daily: 'Once daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
}

export const WORKOUT_TYPES = [
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gym' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'walking', label: 'Walking' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'other', label: 'Other' },
]

export const WORKOUT_INTENSITIES = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'intense', label: 'Intense' },
]

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  photo_url: string | null
  ai_severity: number | null
  user_severity: number | null
  ai_summary: string | null
  notes: string | null
  created_at: string
}

export interface DietEntry {
  id: string
  log_id: string
  food_item: string
  is_trigger: boolean
  meal_type: MealType
}

export interface SkincareProduct {
  id: string
  user_id: string
  name: string
  category: string | null
  frequency: Frequency | null
  photo_url: string | null
}

export interface Medication {
  id: string
  user_id: string
  name: string
  type: string | null
  frequency: Frequency | null
  dosage: string | null
  photo_url: string | null
}

export interface LifestyleFactors {
  log_id: string
  sleep_hours: number | null
  stress_level: number | null
  exercise_minutes: number | null
  water_glasses: number | null
  menstrual_cycle_day: number | null
  workout_type: string | null
  workout_intensity: string | null
}

export interface DailyLogWithDetails extends DailyLog {
  diet_entries: DietEntry[]
  log_skincare: Array<{ product_id: string; skincare_products: SkincareProduct }>
  log_medications: Array<{ medication_id: string; taken: boolean; medications: Medication }>
  lifestyle_factors: LifestyleFactors | null
}

export interface GeminiAnalysis {
  severity: number
  inflammation: 'low' | 'medium' | 'high'
  affected_areas: string[]
  summary: string
}

export interface GeminiProductID {
  name: string | null
  category: string
  frequency_suggestion: Frequency
  dosage: string | null
}
