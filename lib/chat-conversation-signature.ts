type ConversationDisplay = {
  id: string
  customer_name?: string | null
  avatar_url?: string | null
  last_message_at?: string | null
  updated_at?: string | null
  last_message?: string | null
  mode?: string | null
  state?: string | null
  status?: string | null
  memory?: Record<string, unknown> | null
}

// Profile updates can arrive after the message that opened the conversation.
// Keep them in the comparison even when the message and its timestamp stay equal.
export function getConversationDisplaySignature(conversations: ConversationDisplay[]) {
  return conversations
    .map(conversation => [
      conversation.id,
      conversation.customer_name,
      conversation.avatar_url,
      conversation.last_message_at,
      conversation.updated_at,
      conversation.last_message,
      conversation.mode,
      conversation.state,
      conversation.status,
      JSON.stringify(conversation.memory || {}),
    ].join("::"))
    .join("||")
}
