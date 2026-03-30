// src/services/nuvemshop.service.ts

export async function getOrdersByPhone(phone: string) {
  const token = "TOKEN_DA_LOJA"
  const storeId = "STORE_ID"

  const res = await fetch(
    `https://api.tiendanube.com/v1/${storeId}/orders`,
    {
      headers: {
        Authentication: `bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  )

  const data = await res.json()

  // 🔥 filtra pelo telefone
  return data.filter((order: any) =>
    order.contact_phone?.includes(phone)
  )
}