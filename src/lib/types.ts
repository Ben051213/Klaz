export type Role = "teacher" | "student"
export type SessionStatus = "active" | "ended"
export type ConfidenceSignal = "confused" | "partial" | "understood"
export type PracticeStatus = "pending" | "approved" | "sent"
export type Difficulty = "easy" | "medium" | "hard"

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  avatar_url?: string
  created_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  subject: string
  grade?: string
  join_code: string
  is_active: boolean
  created_at: string
  profiles?: Profile
  student_count?: number
}

export interface ClassEnrollment {
  id: string
  class_id: string
  student_id: string
  joined_at: string
  profiles?: Profile
}

export interface Session {
  id: string
  class_id: string
  teacher_id: string
  title: string
  lesson_plan?: string
  ai_context?: string
  status: SessionStatus
  started_at: string
  ended_at?: string
  classes?: Class
}

export interface Message {
  id: string
  session_id: string
  student_id: string
  student_text: string
  ai_response?: string
  topics: string[]
  confidence_signal?: ConfidenceSignal
  created_at: string
  profiles?: Profile
}

export interface TopicScore {
  id: string
  student_id: string
  class_id: string
  topic: string
  score: number
  last_updated: string
}

export interface PracticeSet {
  id: string
  student_id: string
  session_id: string
  topics: string[]
  status: PracticeStatus
  created_at: string
  profiles?: Profile
  practice_items?: PracticeItem[]
}

export interface PracticeItem {
  id: string
  practice_set_id: string
  question: string
  answer: string
  hint?: string
  difficulty: Difficulty
  sort_order: number
}

export interface TopicConfusion {
  topic: string
  confusedCount: number
  totalMessages: number
  percentage: number
}
