export type Sentiment = 'positive' | 'neutral' | 'negative'
export type InteractionStatus = 'draft' | 'saved'

export interface InteractionState {
  id: string | null
  status: InteractionStatus

  hcpName: string | null
  interactionType: string | null
  date: string | null
  time: string | null

  attendees: string[]
  topicsDiscussed: string[]
  materialsShared: string[]
  samplesDistributed: string[]

  sentiment: Sentiment | null

  outcomes: string | null
  followUpActions: string[]

  aiSuggestedFollowUps: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
