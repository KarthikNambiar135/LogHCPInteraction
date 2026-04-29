import './App.css'

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
  deleteSavedInteraction,
  getSavedInteraction,
  listSavedInteractions,
  sendChatMessage,
} from './api/logaiApi'
import AIAssistantPanel from './components/AIAssistantPanel'
import InteractionDetailsPanel from './components/InteractionDetailsPanel'
import { addMessage, replaceMessages, setIsSending } from './slices/chatSlice'
import {
  replaceInteractionState,
  setValidationErrors,
} from './slices/interactionSlice'
import type { AppDispatch, RootState } from './store'
import type { ChatMessage } from './types'
import { getOrCreateSessionId, setSessionId } from './utils/session'

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const interaction = useSelector(
    (s: RootState) => s.interaction.interaction,
  )
  const validationErrors = useSelector(
    (s: RootState) => s.interaction.validationErrors,
  )
  const messages = useSelector((s: RootState) => s.chat.messages)
  const isSending = useSelector((s: RootState) => s.chat.isSending)

  const [saved, setSaved] = useState<
    Array<{
      id: string
      hcpName: string | null
      date: string | null
      sentiment: string | null
      createdAt: string
    }>
  >([])
  const [isSavedLoading, setIsSavedLoading] = useState(false)
  const [loadingSavedId, setLoadingSavedId] = useState<string | null>(null)
  const [deletingSavedId, setDeletingSavedId] = useState<string | null>(null)

  const savedSummary = useMemo(() => saved, [saved])

  const refreshSaved = async () => {
    setIsSavedLoading(true)
    try {
      const resp = await listSavedInteractions({ limit: 50 })
      setSaved(
        resp.items.map((i) => ({
          id: i.id,
          hcpName: i.hcpName,
          date: i.date,
          sentiment: i.sentiment,
          createdAt: i.createdAt,
        })),
      )
    } catch {
      // ignore; UI will just show empty saved list
    } finally {
      setIsSavedLoading(false)
    }
  }

  useEffect(() => {
    void refreshSaved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (interaction.status === 'saved' && interaction.id) {
      void refreshSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.status, interaction.id])

  const onLoadSaved = async (id: string) => {
    if (!id) return
    setLoadingSavedId(id)
    try {
      const resp = await getSavedInteraction(id)

      // Use the saved record id as sessionId so backend restores context.
      setSessionId(id)

      dispatch(replaceInteractionState(resp.interactionState))
      dispatch(setValidationErrors({}))
      dispatch(
        replaceMessages(
          (resp.conversation as ChatMessage[])?.length
            ? (resp.conversation as ChatMessage[])
            : [],
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      dispatch(addMessage({ role: 'assistant', content: `Error: ${msg}` }))
    } finally {
      setLoadingSavedId(null)
    }
  }

  const onDeleteSaved = async (id: string) => {
    if (!id) return
    setDeletingSavedId(id)
    try {
      await deleteSavedInteraction(id)
      setSaved((prev) => prev.filter((s) => s.id !== id))
      void refreshSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      dispatch(addMessage({ role: 'assistant', content: `Error: ${msg}` }))
    } finally {
      setDeletingSavedId(null)
    }
  }

  const onSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    dispatch(addMessage({ role: 'user', content: trimmed }))
    dispatch(setIsSending(true))

    try {
      const resp = await sendChatMessage({
        sessionId: getOrCreateSessionId(),
        message: trimmed,
        interactionState: interaction,
      })

      dispatch(addMessage({ role: 'assistant', content: resp.assistantMessage }))
      dispatch(replaceInteractionState(resp.interactionState))
      dispatch(setValidationErrors(resp.validationErrors ?? {}))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      dispatch(addMessage({ role: 'assistant', content: `Error: ${msg}` }))
    } finally {
      dispatch(setIsSending(false))
    }
  }

  return (
    <div className="page" aria-label="Log Interaction Screen">
      <header className="pageHeader">
        <h1 className="pageTitle">Log HCP Interaction</h1>
      </header>
      <main className="pageBody">
        <InteractionDetailsPanel
          interaction={interaction}
          validationErrors={validationErrors}
          savedInteractions={savedSummary}
          isSavedLoading={isSavedLoading}
          loadingSavedId={loadingSavedId}
          deletingSavedId={deletingSavedId}
          onLoadSaved={onLoadSaved}
          onDeleteSaved={onDeleteSaved}
        />
        <AIAssistantPanel
          messages={messages}
          isSending={isSending}
          onSend={onSend}
        />
      </main>
    </div>
  )
}

export default App
