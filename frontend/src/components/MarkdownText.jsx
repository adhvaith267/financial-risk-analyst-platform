// Minimal renderer for the agent's markdown-ish replies: **bold** and
// "- " bullet lists. No external markdown library - this is the only
// formatting the agent's system prompt actually produces.

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function MarkdownText({ text }) {
  const blocks = text.trim().split(/\n\s*\n/)

  return (
    <div className="chat-text">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim())
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()))

        if (isList) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trim().replace(/^[-*]\s+/, ''), `${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }

        return <p key={i}>{renderInline(block, `${i}`)}</p>
      })}
    </div>
  )
}
