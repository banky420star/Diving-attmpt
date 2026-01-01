import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'

// PUT /api/drivers/[id] - Update driver (location, status, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request, ['manager', 'driver'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const session = auth.session
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const { id } = await params
    if (session.role === 'driver' && session.sub !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
    const existingDriver = await db.driver.findUnique({
      where: { id },
      select: { isActive: true }
    })

    if (!existingDriver) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      )
    }

    if (existingDriver.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Driver account disabled' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, latitude, longitude } = body

    const updateData: any = {}

    if (status) {
      updateData.status = status
    }

    if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = latitude
      updateData.longitude = longitude
      updateData.lastActiveAt = new Date()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    const driver = await db.driver.update({
      where: { id },
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

// DELETE /api/drivers/[id] - Deactivate driver
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request, ['manager'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const { id } = await params

    const activeOrders = await db.order.findMany({
      where: {
        assignedDriverId: id,
        status: {
          in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE']
        }
      },
      select: { id: true }
    })

    const result = await db.$transaction(async (tx) => {
      if (activeOrders.length > 0) {
        await tx.order.updateMany({
          where: {
            id: { in: activeOrders.map((order) => order.id) }
          },
          data: {
            status: 'PENDING',
            assignedDriverId: null,
            acceptedAt: null,
            pickedUpAt: null,
            deliveredAt: null,
            actualTime: null
          }
        })
      }

      const driver = await tx.driver.update({
        where: { id },
        data: {
          isActive: false,
          status: 'OFFLINE'
        }
      })

      return { driver, unassignedCount: activeOrders.length }
    })

    const { password: _, ...driverWithoutPassword } = result.driver

    return NextResponse.json({
      success: true,
      data: {
        ...driverWithoutPassword,
        unassignedOrders: result.unassignedCount
      }
    })
  } catch (error) {
    console.error('Error deactivating driver:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate driver' },
      { status: 500 }
    )
  }
}

// GET /api/drivers/[id] - Get single driver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request, ['manager', 'driver'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const session = auth.session
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const { id } = await params
    if (session.role === 'driver' && session.sub !== id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
    const driver = await db.driver.findUnique({
      where: { id },
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

    if (driver.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Driver account disabled' },
        { status: 403 }
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
