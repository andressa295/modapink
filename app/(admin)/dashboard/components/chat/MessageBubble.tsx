type Props = {
  text: string
  type: "client" | "agent"
  time?: string
  status?: "sending" | "sent" | "delivered" | "read"
}

function formatTime(date?: string) {
  if (date) return date

  const now = new Date()
  return now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  })
}

function getStatusIcon(status?: Props["status"]) {
  switch (status) {
    case "sending":
      return "🕓"
    case "sent":
      return "✓"
    case "delivered":
      return "✓✓"
    case "read":
      return "✓✓"
    default:
      return ""
  }
}

export default function MessageBubble({
  text,
  type,
  time,
  status,
}: Props) {

  const formattedTime = formatTime(time)

  return (
    <div className={`message-row ${type === "agent" ? "agent" : ""}`}>

      <div className={`message-bubble ${type}`}>

        {/* TEXTO */}
        <div className="message-text">
          {text.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
        </div>

        {/* FOOTER */}
        <div className="message-meta">

          <span className="message-time">
            {formattedTime}
          </span>

          {type === "agent" && status && (
            <span className={`message-status ${status}`}>
              {getStatusIcon(status)}
            </span>
          )}

        </div>

      </div>

    </div>
  )
}