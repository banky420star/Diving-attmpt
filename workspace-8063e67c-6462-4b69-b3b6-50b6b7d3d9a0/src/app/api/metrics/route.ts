import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/metrics - Get dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Get driver counts
    const totalDrivers = await db.driver.count()
    const onlineDrivers = await db.driver.count({
      where: { status: 'ONLINE' }
    })
    const onJobDrivers = await db.driver.count({
      where: { status: 'ON_JOB' }
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

    const onTimeOrders = deliveredOrders.filter(order => {
      if (!order.estimatedTime || !order.actualTime) return true
      return order.actualTime <= order.estimatedTime
    }).length

    const onTimeRate = deliveredOrders.length > 0 ? (onTimeOrders / deliveredOrders.length) * 100 : 0

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
        averageDeliveryTime: 28 // TODO: Calculate actual average
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