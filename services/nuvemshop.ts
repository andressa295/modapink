import axios from "axios"

const STORE_ID = process.env.NUVEMSHOP_STORE_ID!
const ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN!

export async function getOrderByNumber(orderNumber: string) {
  const response = await axios.get(
    `https://api.nuvemshop.com.br/v1/${STORE_ID}/orders`,
    {
      headers: {
        Authentication: `bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      params: {
        number: orderNumber,
      },
    }
  )

  return response.data
}