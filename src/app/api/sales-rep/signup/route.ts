import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone, commissionRate = 0.10 } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create sales rep user
    const salesRep = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: UserRole.SALES_REP,
        commissionRate,
        // Create a direct password account (not OAuth)
        accounts: {
          create: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            // Store hashed password in access_token field for simplicity
            access_token: hashedPassword,
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Sales rep created successfully',
      salesRepId: salesRep.id
    })

  } catch (error) {
    console.error('Sales rep signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
