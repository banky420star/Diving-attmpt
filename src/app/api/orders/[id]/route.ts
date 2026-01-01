import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'

const LOCATION_GEOFENCE_KM = 0.15

// PUT /api/orders/[id] - Update order (assign driver, update status, etc.)
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
    const body = await request.json()
    const {
      status,
      assignedDriverId,
      acceptedAt,
      pickedUpAt,
      deliveredAt,
      managerRating
    } = body

    const existingOrder = await db.order.findUnique({
      where: { id },
      select: {
        status: true,
        assignedDriverId: true,
        driverPay: true,
        pickupLat: true,
        pickupLng: true,
        deliveryLat: true,
        deliveryLng: true,
        acceptedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        createdAt: true
      }
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (
      session.role === 'driver' &&
      existingOrder.assignedDriverId &&
      existingOrder.assignedDriverId !== session.sub
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (
      session.role === 'driver' &&
      assignedDriverId &&
      assignedDriverId !== session.sub
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (
      session.role === 'driver' &&
      !existingOrder.assignedDriverId &&
      !assignedDriverId &&
      status
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (
      session.role === 'driver' &&
      status &&
      (status === 'PICKED_UP' || status === 'DELIVERED')
    ) {
      const driverLocation = await db.driver.findUnique({
        where: { id: session.sub },
        select: { latitude: true, longitude: true }
      })

      if (
        !driverLocation ||
        driverLocation.latitude == null ||
        driverLocation.longitude == null
      ) {
        return NextResponse.json(
          { success: false, error: 'Driver location required' },
          { status: 400 }
        )
      }

      const target =
        status === 'PICKED_UP'
          ? { lat: existingOrder.pickupLat, lng: existingOrder.pickupLng }
          : { lat: existingOrder.deliveryLat, lng: existingOrder.deliveryLng }

      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        target.lat,
        target.lng
      )

      if (distance > LOCATION_GEOFENCE_KM) {
        return NextResponse.json(
          { success: false, error: 'Too far from the location' },
          { status: 400 }
        )
      }
    }

    const deliveredAtDate = deliveredAt
      ? new Date(deliveredAt)
      : existingOrder.deliveredAt
    const acceptedAtDate = acceptedAt
      ? new Date(acceptedAt)
      : existingOrder.acceptedAt
    const pickedUpAtDate = pickedUpAt
      ? new Date(pickedUpAt)
      : existingOrder.pickedUpAt

    let actualTime: number | undefined
    if (deliveredAtDate) {
      const startTime =
        acceptedAtDate ?? pickedUpAtDate ?? existingOrder.createdAt
      actualTime = Math.max(
        1,
        Math.round((deliveredAtDate.getTime() - startTime.getTime()) / 60000)
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status) {
      updateData.status = status
    }
    if (assignedDriverId !== undefined) {
      updateData.assignedDriverId = assignedDriverId
    }
    if (acceptedAt) {
      updateData.acceptedAt = new Date(acceptedAt)
    }
    if (pickedUpAt) {
      updateData.pickedUpAt = new Date(pickedUpAt)
    }
    if (deliveredAt) {
      updateData.deliveredAt = new Date(deliveredAt)
    }
    if (actualTime !== undefined) {
      updateData.actualTime = actualTime
    }
    const nextStatus = (status as string | undefined) ?? existingOrder.status
    if (managerRating !== undefined) {
      if (session.role !== 'manager') {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        )
      }
      if (nextStatus !== 'DELIVERED') {
        return NextResponse.json(
          { success: false, error: 'Driver ratings require a delivered order' },
          { status: 400 }
        )
      }
      const parsedRating = Number(managerRating)
      const normalizedRating = Math.round(parsedRating)
      if (!Number.isFinite(parsedRating) || normalizedRating < 1 || normalizedRating > 5) {
        return NextResponse.json(
          { success: false, error: 'Rating must be between 1 and 5' },
          { status: 400 }
        )
      }
      updateData.managerRating = normalizedRating
    }

    const order = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        assignedDriver: true,
        createdBy: true
      }
    })

    const nextDriverId = assignedDriverId ?? existingOrder.assignedDriverId

    if (nextStatus === 'DELIVERED' || nextStatus === 'CANCELLED') {
      await db.driverIssue.updateMany({
        where: {
          orderId: id,
          status: 'OPEN'
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      })
    }

    if (
      existingOrder.status !== 'CANCELLED' &&
      nextStatus === 'CANCELLED' &&
      nextDriverId
    ) {
      await db.driverIssue.create({
        data: {
          driverId: nextDriverId,
          orderId: id,
          type: 'OTHER',
          status: 'OPEN',
          message: `Trip cancelled by ${
            session.role === 'driver' ? 'driver' : 'manager'
          }.`
        }
      })
    }

    if (
      existingOrder.status !== 'DELIVERED' &&
      nextStatus === 'DELIVERED' &&
      nextDriverId
    ) {
      const distance = calculateDistance(
        existingOrder.pickupLat,
        existingOrder.pickupLng,
        existingOrder.deliveryLat,
        existingOrder.deliveryLng
      )

      await db.$transaction([
        db.driver.update({
          where: { id: nextDriverId },
          data: {
            totalJobs: { increment: 1 },
            totalEarnings: { increment: order.driverPay }
          }
        }),
        db.earning.create({
          data: {
            driverId: nextDriverId,
            orderId: order.id,
            amount: order.driverPay,
            distance,
            duration: actualTime,
            earnedAt: deliveredAtDate ?? new Date()
          }
        })
      ])
    }

    if (managerRating !== undefined && nextDriverId) {
      const ratingStats = await db.order.aggregate({
        where: {
          assignedDriverId: nextDriverId,
          managerRating: { not: null }
        },
        _avg: { managerRating: true },
        _count: { managerRating: true }
      })
      const avgRating = ratingStats._avg.managerRating ?? 5
      await db.driver.update({
        where: { id: nextDriverId },
        data: {
          rating: avgRating
        }
      })
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// GET /api/orders/[id] - Get single order
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
    const order = await db.order.findUnique({
      where: { id },
      include: {
        assignedDriver: true,
        createdBy: true,
        earnings: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (
      session.role === 'driver' &&
      order.assignedDriverId !== session.sub
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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
