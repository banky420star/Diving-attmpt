import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/orders/[id] - Update order (assign driver, update status, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, assignedDriverId, acceptedAt, pickedUpAt, deliveredAt } = body

    const order = await db.order.update({
      where: { id: params.id },
      data: {
        status,
        assignedDriverId,
        acceptedAt: acceptedAt ? new Date(acceptedAt) : undefined,
        pickedUpAt: pickedUpAt ? new Date(pickedUpAt) : undefined,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
      },
      include: {
        assignedDriver: true,
        createdBy: true
      }
    })

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
  { params }: { params: { id: string } }
) {
  try {
    const order = await db.order.findUnique({
      where: { id: params.id },
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

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}