export type SeverityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

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
}

export interface SkincareProduct {
  id: string
  user_id: string
  name: string
  category: string | null
}

export interface Medication {
  id: string
  user_id: string
  name: string
  type: string | null
}

export interface LifestyleFactors {
  log_id: string
  sleep_hours: number | null
  stress_level: number | null
  exercise_minutes: number | null
  water_glasses: number | null
  menstrual_cycle_day: number | null
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
