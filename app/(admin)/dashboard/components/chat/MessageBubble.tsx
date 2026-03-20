type Props = {
  text: string
  type: "client" | "agent"
  time?: string
}

export default function MessageBubble({ text, type, time }: Props) {
  return (
    <div className={`message-row ${type === "agent" ? "agent" : ""}`}>
      <div className={`message-bubble ${type}`}>
        <span>{text}</span>

        {time && (
          <div className="message-time">{time}</div>
        )}
      </div>
    </div>
  )
}