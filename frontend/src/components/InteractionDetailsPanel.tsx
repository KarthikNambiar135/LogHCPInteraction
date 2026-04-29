import { useEffect, useMemo, useRef, useState } from 'react'

import type { InteractionState, Sentiment } from '../types'

function formatList(items: string[]): string {
  return items.length ? items.join(', ') : ''
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function SentimentRadio({
  value,
  selected,
}: {
  value: Sentiment
  selected: Sentiment | null
}) {
  const id = `sentiment-${value}`
  return (
    <label className="radio">
      <input
        id={id}
        type="radio"
        name="sentiment"
        value={value}
        checked={selected === value}
        disabled
        readOnly
      />
      <span className="radioLabel">{value}</span>
    </label>
  )
}

export default function InteractionDetailsPanel({
  interaction,
  validationErrors,
  savedInteractions,
  isSavedLoading,
  loadingSavedId,
  deletingSavedId,
  onLoadSaved,
  onDeleteSaved,
}: {
  interaction: InteractionState
  validationErrors: Record<string, string>
  savedInteractions: Array<{
    id: string
    hcpName: string | null
    date: string | null
    sentiment: string | null
    createdAt: string
  }>
  isSavedLoading: boolean
  loadingSavedId: string | null
  deletingSavedId: string | null
  onLoadSaved: (id: string) => Promise<void>
  onDeleteSaved: (id: string) => Promise<void>
}) {
  void validationErrors // kept for future inline validation; UI matches screenshot (no banner)

  const [isSavedOpen, setIsSavedOpen] = useState(false)
  const [savedQuery, setSavedQuery] = useState('')
  const savedMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSavedOpen) return

    const onPointerDown = (e: PointerEvent) => {
      const el = savedMenuRef.current
      if (!el) return
      if (!(e.target instanceof Node)) return
      if (!el.contains(e.target)) setIsSavedOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSavedOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isSavedOpen])

  const filteredSaved = useMemo(() => {
    const q = savedQuery.trim().toLowerCase()
    if (!q) return savedInteractions
    return savedInteractions.filter((s) => {
      const haystack = [
        s.id,
        s.hcpName ?? '',
        s.date ?? '',
        s.sentiment ?? '',
        s.createdAt ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [savedInteractions, savedQuery])

  const interactionTypeOptions = uniq(
    [interaction.interactionType, 'Meeting', 'In-person', 'Virtual', 'Phone', 'Email']
      .filter(Boolean)
      .map(String),
  )

  return (
    <section className="panel">
      <header className="panelHeader">
        <div>
          <h2 className="panelTitle">Interaction Details</h2>
          <p className="panelSubtitle">AI-controlled form</p>
        </div>

        <div className="panelHeaderActions">
          <div className="savedDropdown" ref={savedMenuRef}>
            <button
              type="button"
              className="savedDropdownBtn"
              onClick={() => setIsSavedOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isSavedOpen}
              aria-label="Saved interactions"
            >
              Saved
              {savedInteractions.length ? ` (${savedInteractions.length})` : ''}
              <span className="savedDropdownCaret">▾</span>
            </button>

            {isSavedOpen ? (
              <div className="savedMenu" role="menu" aria-label="Saved interactions menu">
                <div className="savedMenuTop">
                  <input
                    value={savedQuery}
                    onChange={(e) => setSavedQuery(e.target.value)}
                    placeholder="Search saved…"
                    aria-label="Search saved interactions"
                  />
                </div>

                <div className="savedMenuMeta">
                  {isSavedLoading ? 'Loading…' : `${filteredSaved.length} item(s)`}
                </div>

                {filteredSaved.length === 0 ? (
                  <div className="savedEmpty">No saved interactions.</div>
                ) : (
                  <div className="savedMenuList">
                    {filteredSaved.map((s) => (
                      <div key={s.id} className="savedRow">
                        <div className="savedSummary">
                          <div className="savedPrimary">
                            {(s.hcpName ?? 'Unknown HCP') + (s.date ? ` — ${s.date}` : '')}
                          </div>
                          <div className="savedSecondary">
                            {(s.sentiment ?? '—') + ` • ${new Date(s.createdAt).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="savedActions">
                          <button
                            type="button"
                            className="savedLoadBtn"
                            onClick={() => {
                              setIsSavedOpen(false)
                              void onLoadSaved(s.id)
                            }}
                            disabled={loadingSavedId === s.id}
                          >
                            {loadingSavedId === s.id ? 'Loading…' : 'Load'}
                          </button>
                          <button
                            type="button"
                            className="savedDeleteBtn"
                            onClick={() => void onDeleteSaved(s.id)}
                            disabled={deletingSavedId === s.id}
                          >
                            {deletingSavedId === s.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="panelBody">
        <form className="form" aria-label="Interaction details form (read-only)">
          <div className="fieldRow">
            <div className="field">
              <label>HCP Name</label>
              <input
                value={interaction.hcpName ?? ''}
                placeholder="Search or select HCP…"
                readOnly
                disabled
              />
            </div>

            <div className="field">
              <label>Interaction Type</label>
              <select value={interaction.interactionType ?? 'Meeting'} disabled>
                {interactionTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fieldRow">
            <div className="field">
              <label>Date</label>
              <input type="date" value={interaction.date ?? ''} readOnly disabled />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" value={interaction.time ?? ''} readOnly disabled />
            </div>
          </div>

          <div className="field">
            <label>Attendees</label>
            <input
              value={formatList(interaction.attendees)}
              placeholder="Enter names or search…"
              readOnly
              disabled
            />
          </div>

          <div className="field">
            <label>Topics Discussed</label>
            <div className="fieldWithIcon">
              <textarea
                value={formatList(interaction.topicsDiscussed)}
                placeholder="Enter key discussion points…"
                readOnly
                disabled
              />
              <button type="button" className="iconBtn" disabled aria-label="Voice note">
                🎤
              </button>
            </div>
          </div>

          <button type="button" className="collapseRow" disabled>
            <span className="collapseCaret">›</span>
            <span>Summarize from Voice Note</span>
            <span className="collapseNote">Requires Consent</span>
          </button>

          <section className="subsection" aria-label="Materials shared and samples distributed">
            <div className="subsectionHeader">Materials Shared / Samples Distributed</div>

            <div className="miniRow">
              <div>
                <div className="miniTitle">Materials Shared</div>
                <div className="miniHint">
                  {interaction.materialsShared.length
                    ? formatList(interaction.materialsShared)
                    : 'No materials added.'}
                </div>
              </div>
              <button type="button" className="miniAction" disabled>
                Search/Add
              </button>
            </div>

            <div className="miniRow">
              <div>
                <div className="miniTitle">Samples Distributed</div>
                <div className="miniHint">
                  {interaction.samplesDistributed.length
                    ? formatList(interaction.samplesDistributed)
                    : 'No samples added.'}
                </div>
              </div>
              <button type="button" className="miniAction" disabled>
                Add Sample
              </button>
            </div>
          </section>

          <div className="field">
            <label>Observed/Inferred HCP Sentiment</label>
            <div className="radioRow">
              <SentimentRadio value="positive" selected={interaction.sentiment} />
              <SentimentRadio value="neutral" selected={interaction.sentiment} />
              <SentimentRadio value="negative" selected={interaction.sentiment} />
            </div>
          </div>

          <div className="field">
            <label>Outcomes</label>
            <textarea
              value={interaction.outcomes ?? ''}
              placeholder="Key outcomes or agreements…"
              readOnly
              disabled
            />
          </div>

          <div className="field">
            <label>Follow-up Actions</label>
            <textarea
              value={formatList(interaction.followUpActions)}
              placeholder="Enter next steps or tasks…"
              readOnly
              disabled
            />
          </div>

          <section className="suggestions" aria-label="AI suggested follow-ups">
            <div className="suggestionsTitle">AI Suggested Follow-ups:</div>
            {interaction.aiSuggestedFollowUps.length ? (
              <ul className="suggestionsList">
                {interaction.aiSuggestedFollowUps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <div className="suggestionsEmpty">
                No suggestions yet. Ask the assistant: “Suggest follow-up actions.”
              </div>
            )}
          </section>
        </form>
      </div>
    </section>
  )
}
