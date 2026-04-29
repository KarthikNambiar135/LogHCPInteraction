import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { InteractionState } from '../types'

export interface InteractionSliceState {
  interaction: InteractionState
  validationErrors: Record<string, string>
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toIsoTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function makeBlankInteraction(): InteractionState {
  const now = new Date()
  return {
    id: null,
    status: 'draft',

    hcpName: null,
    interactionType: 'Meeting',
    date: toIsoDate(now),
    time: toIsoTime(now),

    attendees: [],
    topicsDiscussed: [],
    materialsShared: [],
    samplesDistributed: [],

    sentiment: 'neutral',

    outcomes: null,
    followUpActions: [],

    aiSuggestedFollowUps: [],
  }
}

const initialState: InteractionSliceState = {
  interaction: makeBlankInteraction(),
  validationErrors: {},
}

const interactionSlice = createSlice({
  name: 'interaction',
  initialState,
  reducers: {
    replaceInteractionState: (state, action: PayloadAction<InteractionState>) => {
      state.interaction = action.payload
    },
    setValidationErrors: (
      state,
      action: PayloadAction<Record<string, string>>,
    ) => {
      state.validationErrors = action.payload
    },
    resetInteraction: (state) => {
      state.interaction = makeBlankInteraction()
      state.validationErrors = {}
    },
  },
})

export const { replaceInteractionState, setValidationErrors, resetInteraction } =
  interactionSlice.actions

export default interactionSlice.reducer
