type Props = {
  text: string
  type: "client" | "agent"
}

export default function MessageBubble({ text, type }: Props) {
  return (
    <div className={`message ${type}`}>
      {text}
    </div>
  )
}