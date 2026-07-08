export interface QuestionOption {
  id: string
  label: string
  description?: string
}

export interface Question {
  id: string
  type: "multiple_choice" | "confirm" | "input"
  title: string
  description?: string
  options?: QuestionOption[]
  required: boolean
  allowMultiple?: boolean
}

export interface QuestionReply {
  questionId: string
  selected: string | string[]
  text?: string
}

export interface PromptInput {
  id: string
  prompt: string
  attachments?: Array<{ type: "file" | "image" | "text"; content: string; name?: string }>
  model?: string
  systemPrompt?: string
  question?: Question
}
