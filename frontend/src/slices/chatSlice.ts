import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { ChatMessage } from '../types'

interface ChatState {
  messages: ChatMessage[]
  isSending: boolean
}

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Log interaction details here (e.g., “Met Dr. Smith, discussed Prodo-X efficacy, positive sentiment, shared brochure”) or ask for help.",
}

const initialState: ChatState = {
  messages: [INITIAL_ASSISTANT_MESSAGE],
  isSending: false,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload)
    },
    replaceMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      const next = action.payload.length
        ? action.payload
        : [INITIAL_ASSISTANT_MESSAGE]
      state.messages = next
      state.isSending = false
    },
    setIsSending: (state, action: PayloadAction<boolean>) => {
      state.isSending = action.payload
    },
    resetChat: (state) => {
      state.messages = [INITIAL_ASSISTANT_MESSAGE]
      state.isSending = false
    },
  },
})

export const { addMessage, replaceMessages, setIsSending, resetChat } =
  chatSlice.actions

export default chatSlice.reducer
