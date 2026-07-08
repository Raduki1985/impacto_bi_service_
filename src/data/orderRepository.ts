import type { ServiceOrder } from './dashboardTypes'
import { orders } from './mockOsData'

const ordersApiUrl = import.meta.env.VITE_ORDERS_API_URL as string | undefined

export async function getOrders(): Promise<ServiceOrder[]> {
  if (!ordersApiUrl) return orders

  try {
    const response = await fetch(ordersApiUrl)

    if (!response.ok) {
      throw new Error(`Orders API responded with ${response.status}`)
    }

    return (await response.json()) as ServiceOrder[]
  } catch {
    return orders
  }
}
