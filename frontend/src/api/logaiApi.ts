import type { ChatMessage, InteractionState, Sentiment } from '../types'

export interface ChatResponseDto {
  assistantMessage: string
  interactionState: InteractionState
  validationErrors: Record<string, string>
}

export interface SavedInteractionDto {
  id: string
  status: string
  hcpName: string | null
  date: string | null
  sentiment: Sentiment | null
  createdAt: string
  updatedAt: string
}

export interface ListSavedInteractionsResponseDto {
  items: SavedInteractionDto[]
}

export interface GetSavedInteractionResponseDto {
  interactionState: InteractionState
  conversation: ChatMessage[]
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000'

export async function sendChatMessage(params: {
  sessionId: string
  message: string
  interactionState: InteractionState
}): Promise<ChatResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      message: params.message,
      interactionState: params.interactionState,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }

  return (await res.json()) as ChatResponseDto
}

export async function listSavedInteractions(params?: {
  limit?: number
}): Promise<ListSavedInteractionsResponseDto> {
  const limit = params?.limit ?? 20
  const res = await fetch(`${API_BASE_URL}/api/interactions?limit=${limit}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }
  return (await res.json()) as ListSavedInteractionsResponseDto
}

export async function getSavedInteraction(
  id: string,
): Promise<GetSavedInteractionResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/interactions/${id}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }
  return (await res.json()) as GetSavedInteractionResponseDto
}

export async function deleteSavedInteraction(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/interactions/${id}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }
}
