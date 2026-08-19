import { useState } from 'react'
import api from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import MarkdownText from '../components/MarkdownText.jsx'
import AgentTrace from '../components/AgentTrace.jsx'
import EvidencePanel from '../components/EvidencePanel.jsx'

const examples = [
  'Assess borrower B1001 and explain the major factors driving the risk.',
  'What is the current market risk of portfolio P001?',
  'What happens to P001 if we hit a recession?',
  'Assess borrower B1005 and show the impact of a 25% equity market decline.',
]

export default function AIAnalyst() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  async function send(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setQuestion('')
    setLoading(true)
    try {
      const { data } = await api.post('/agent/ask', { question: q })
      setMessages((prev) => [...prev, { role: 'agent', text: data.answer, trace: data.trace }])
    } catch (err) {
      const detail = err.response?.data?.detail || err.message
      setMessages((prev) => [...prev, { role: 'error', text: detail }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="analyst-page">
      <PageHeader
        title="AI Analyst"
        subtitle="Ask in plain language. The agent decides which tools to call - it never invents a PD, VaR, or loss figure itself."
      />

      {messages.length === 0 && (
        <div className="examples">
          {examples.map((ex) => (
            <button key={ex} className="example-chip" onClick={() => setQuestion(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-${m.role}`}>
            <div className="chat-role">
              {m.role === 'user' ? 'You' : m.role === 'agent' ? 'Risk Analyst Agent' : 'Error'}
            </div>
            {m.role === 'agent' ? (
              <>
                <AgentTrace steps={m.trace} />
                <MarkdownText text={m.text} />
                <EvidencePanel trace={m.trace} />
              </>
            ) : (
              <div className="chat-text">{m.text}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-agent">
            <div className="chat-role">Risk Analyst Agent</div>
            <div className="chat-text chat-loading">Thinking, calling tools…</div>
          </div>
        )}
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a borrower, portfolio, or scenario..."
        />
        <button type="submit" disabled={loading}>
          Analyze
        </button>
      </form>
    </div>
  )
}
