import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/assign - Smart order assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, notifyCount = 3 } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get the order details
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        assignedDriver: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Order is not pending assignment' },
        { status: 400 }
      )
    }

    // Get available drivers (online and not on job)
    const availableDrivers = await db.driver.findMany({
      where: {
        status: 'ONLINE'
      },
      include: {
        assignedOrders: {
          where: {
            status: {
              in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE']
            }
          }
        }
      }
    })

    // Filter drivers who are not currently on a job
    const trulyAvailableDrivers = availableDrivers.filter(
      driver => driver.assignedOrders.length === 0
    )

    if (trulyAvailableDrivers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No available drivers' },
        { status: 400 }
      )
    }

    // Calculate scores for each driver
    const scoredDrivers = trulyAvailableDrivers.map(driver => {
      const distance = calculateDistance(
        order.pickupLat, order.pickupLng,
        driver.latitude || 0, driver.longitude || 0
      )
      
      // Score factors: distance (closer is better), rating, recent activity
      const distanceScore = Math.max(0, 100 - distance * 10) // Max 100, decreases with distance
      const ratingScore = driver.rating * 20 // Max 100
      const activityScore = Math.min(100, (Date.now() - driver.lastActiveAt.getTime()) / (1000 * 60 * 60) * 10) // Recent activity
      
      const totalScore = distanceScore + ratingScore + activityScore

      return {
        ...driver,
        distance,
        score: totalScore
      }
    })

    // Sort by score (highest first) and take top drivers
    const topDrivers = scoredDrivers
      .sort((a, b) => b.score - a.score)
      .slice(0, notifyCount)

    // Remove passwords from response
    const driversWithoutPasswords = topDrivers.map(({ password, ...driver }) => driver)

    return NextResponse.json({ 
      success: true, 
      data: {
        orderId,
        recommendedDrivers: driversWithoutPasswords,
        totalAvailable: trulyAvailableDrivers.length
      }
    })
  } catch (error) {
    console.error('Error in order assignment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process assignment' },
      { status: 500 }
    )
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}