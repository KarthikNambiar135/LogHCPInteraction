import { configureStore } from '@reduxjs/toolkit'

import chatReducer from './slices/chatSlice'
import interactionReducer from './slices/interactionSlice'

export const store = configureStore({
  reducer: {
    interaction: interactionReducer,
    chat: chatReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
