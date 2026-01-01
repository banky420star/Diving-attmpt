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

    const admin = await db.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      const adminCount = await db.admin.count()
      if (adminCount < 2) {
        const hashedPassword = await hashPassword(password)
        const created = await db.admin.create({
          data: {
            email,
            password: hashedPassword,
            name: 'Admin',
            phone: null
          }
        })
        const { password: _, ...adminWithoutPassword } = created
        const token = createSessionToken('manager', created.id)
        const response = NextResponse.json({
          success: true,
          data: { ...adminWithoutPassword, created: true }
        })
        applySessionCookie(response, token)
        return response
      }

      return NextResponse.json(
        { success: false, error: 'Manager limit reached' },
        { status: 403 }
      )
    }

    const isValid = await verifyPassword(password, admin.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (needsRehash(admin.password)) {
      const hashedPassword = await hashPassword(password)
      await db.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword }
      })
    }

    const { password: _, ...adminWithoutPassword } = admin

    const token = createSessionToken('manager', admin.id)
    const response = NextResponse.json({
      success: true,
      data: adminWithoutPassword
    })
    applySessionCookie(response, token)
    return response
  } catch (error) {
    console.error('Error logging in admin:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log in' },
      { status: 500 }
    )
  }
}
