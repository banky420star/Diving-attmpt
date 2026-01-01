import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'

// GET /api/metrics - Get dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['manager'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Get driver counts
    const totalDrivers = await db.driver.count({
      where: { isActive: true }
    })
    const onlineDrivers = await db.driver.count({
      where: { status: 'ONLINE', isActive: true }
    })
    const onJobDrivers = await db.driver.count({
      where: { status: 'ON_JOB', isActive: true }
    })

    // Get order counts
    const totalOrders = await db.order.count()
    const todayOrders = await db.order.count({
      where: {
        createdAt: {
          gte: startOfDay
        }
      }
    })
    
    const activeDeliveries = await db.order.count({
      where: {
        status: {
          in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE']
        }
      }
    })

    // Get financial metrics
    const orders = await db.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay
        }
      },
      include: {
        earnings: true
      }
    })

    const todayRevenue = orders.reduce((sum, order) => sum + order.orderValue + order.deliveryFee, 0)
    const todayDeliveryFees = orders.reduce((sum, order) => sum + order.deliveryFee, 0)
    const todayDriverPayouts = orders.reduce((sum, order) => sum + order.driverPay, 0)
    const todayProfit = todayDeliveryFees - todayDriverPayouts
    const averageMargin = todayDeliveryFees > 0 ? (todayProfit / todayDeliveryFees) * 100 : 0

    // Get on-time rate (orders delivered within estimated time)
    const deliveredOrders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: {
          gte: startOfDay
        }
      }
    })

    const deliveryStats = deliveredOrders
      .map((order) => {
        const actualTime = getActualMinutes(order)
        if (actualTime === null) return null
        const estimate =
          order.estimatedTime ?? estimateDeliveryTime(order)
        return {
          actualTime,
          estimate
        }
      })
      .filter((value): value is { actualTime: number; estimate: number } =>
        Boolean(value)
      )

    const totalActual = deliveryStats.reduce(
      (sum, stat) => sum + stat.actualTime,
      0
    )
    const averageDeliveryTime =
      deliveryStats.length > 0
        ? Math.round(totalActual / deliveryStats.length)
        : 0

    const onTimeOrders = deliveryStats.filter(
      (stat) => stat.actualTime <= stat.estimate
    ).length

    const onTimeRate =
      deliveryStats.length > 0
        ? (onTimeOrders / deliveryStats.length) * 100
        : 0

    // Get driver earnings for today
    const driverEarnings = await db.earning.aggregate({
      where: {
        earnedAt: {
          gte: startOfDay
        }
      },
      _sum: {
        amount: true
      }
    })

    const metrics = {
      drivers: {
        total: totalDrivers,
        online: onlineDrivers,
        onJob: onJobDrivers,
        available: onlineDrivers - onJobDrivers
      },
      orders: {
        total: totalOrders,
        today: todayOrders,
        active: activeDeliveries
      },
      financial: {
        todayRevenue,
        todayDeliveryFees,
        todayDriverPayouts,
        todayProfit,
        averageMargin: Math.round(averageMargin * 10) / 10,
        driverEarnings: driverEarnings._sum.amount || 0
      },
      performance: {
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        averageDeliveryTime
      }
    }

    return NextResponse.json({ success: true, data: metrics })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

type DeliveredOrder = {
  actualTime: number | null
  acceptedAt: Date | null
  createdAt: Date
  deliveredAt: Date | null
  estimatedTime: number | null
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
}

function getActualMinutes(order: DeliveredOrder) {
  if (typeof order.actualTime === 'number') return order.actualTime
  if (!order.deliveredAt) return null
  const startTime = order.acceptedAt ?? order.createdAt
  return Math.max(
    1,
    Math.round((order.deliveredAt.getTime() - startTime.getTime()) / 60000)
  )
}

function estimateDeliveryTime(order: DeliveredOrder) {
  const distance = calculateDistance(
    order.pickupLat,
    order.pickupLng,
    order.deliveryLat,
    order.deliveryLng
  )
  return Math.max(10, Math.round(distance * 6 + 8))
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
