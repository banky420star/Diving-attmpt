import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  applySessionCookie,
  createSessionToken,
  hashPassword,
  needsRehash,
  verifyPassword
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body?.email ?? '').trim()
    const password = String(body?.password ?? '').trim()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const driver = await db.driver.findUnique({
      where: { email }
    })

    if (!driver) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, driver.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (driver.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Driver account disabled' },
        { status: 403 }
      )
    }

    if (needsRehash(driver.password)) {
      const hashedPassword = await hashPassword(password)
      await db.driver.update({
        where: { id: driver.id },
        data: { password: hashedPassword }
      })
    }

    const { password: _, ...driverWithoutPassword } = driver

    const token = createSessionToken('driver', driver.id)
    const response = NextResponse.json({
      success: true,
      data: driverWithoutPassword
    })
    applySessionCookie(response, token)
    return response
  } catch (error) {
    console.error('Error logging in driver:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log in' },
      { status: 500 }
    )
  }
}
