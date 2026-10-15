export const chatTabIds = ["all", "human", "principal", "vendedora_1", "vendedora_2", "sac", "automacoes", "teste"] as const

export type ChatTabId = typeof chatTabIds[number]

export function getRequestedChatTab(search: string): ChatTabId {
  const requested = new URLSearchParams(search).get("tab")
  return chatTabIds.find(tab => tab === requested) || "all"
}
