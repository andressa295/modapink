// services/rating.service.ts

export function checkForRating(conv: any) {
  const now = Date.now()
  const diff = now - conv.lastMessageAt

  const HOURS_24 = 24 * 60 * 60 * 1000

  if (diff > HOURS_24 && !conv.rating) {
    return true
  }

  return false
}