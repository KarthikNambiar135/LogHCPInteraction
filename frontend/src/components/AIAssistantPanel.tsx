import { useState, type FormEvent } from 'react'

import type { ChatMessage } from '../types'

export default function AIAssistantPanel({
  messages,
  isSending,
  onSend,
}: {
  messages: ChatMessage[]
  isSending: boolean
  onSend: (text: string) => Promise<void>
}) {
  const [input, setInput] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return

    setInput('')
    await onSend(text)
  }

  return (
    <section className="panel">
      <header className="panelHeader">
        <div>
          <h2 className="panelTitle">AI Assistant</h2>
          <p className="panelSubtitle">Log interaction via chat</p>
        </div>
      </header>

      <div className="panelBody chatBody">
        <div className="chatMessages" role="log" aria-label="Chat messages">
          {messages.length === 0 ? (
            <p className="chatEmpty">
              Try: “Today I met with Dr. Smith… sentiment was positive… brochures
              were shared.”
            </p>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={m.role === 'user' ? 'chatMsg chatMsgUser' : 'chatMsg'}
              >
                <div className="chatRole">{m.role}</div>
                <div className="chatContent">{m.content}</div>
              </div>
            ))
          )}
        </div>

        <form className="chatComposer" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe interaction…"
            aria-label="Chat input"
          />
          <button type="submit" disabled={isSending || !input.trim()}>
            {isSending ? 'Logging…' : 'Log'}
          </button>
        </form>
      </div>
    </section>
  )
}
