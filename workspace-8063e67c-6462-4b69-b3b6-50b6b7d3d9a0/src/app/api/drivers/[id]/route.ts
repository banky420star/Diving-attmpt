import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/drivers/[id] - Update driver (location, status, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, latitude, longitude } = body

    const updateData: any = {
      lastActiveAt: new Date()
    }

    if (status) {
      updateData.status = status
    }

    if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = latitude
      updateData.longitude = longitude
    }

    const driver = await db.driver.update({
      where: { id: params.id },
      data: updateData
    })

    // Remove password from response
    const { password: _, ...driverWithoutPassword } = driver

    return NextResponse.json({ success: true, data: driverWithoutPassword })
  } catch (error) {
    console.error('Error updating driver:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update driver' },
      { status: 500 }
    )
  }
}

// GET /api/drivers/[id] - Get single driver
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const driver = await db.driver.findUnique({
      where: { id: params.id },
      include: {
        assignedOrders: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        earnings: {
          orderBy: {
            earnedAt: 'desc'
          },
          take: 20
        },
        payouts: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!driver) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      )
    }

    // Remove password from response
    const { password: _, ...driverWithoutPassword } = driver

    return NextResponse.json({ success: true, data: driverWithoutPassword })
  } catch (error) {
    console.error('Error fetching driver:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch driver' },
      { status: 500 }
    )
  }
}