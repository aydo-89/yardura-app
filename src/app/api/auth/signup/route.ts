import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      name,
      phone,
      address,
      city,
      zipCode,
      yardSize,
      daysSinceLastClean,
      dogs,
      servicePreferences
    } = await request.json()

    // Validate required fields
    if (!email || !password || !name || !address || !zipCode) {
      return NextResponse.json(
        { error: 'Email, password, name, address, and zip code are required' },
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

    // Create the user account
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        address,
        city,
        zipCode,
        role: UserRole.CUSTOMER,
        // Create a direct password account
        accounts: {
          create: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            access_token: hashedPassword,
          }
        }
      }
    })

    // Create dog profiles
    if (dogs && dogs.length > 0) {
      for (const dogData of dogs) {
        if (dogData.name?.trim()) {
          await prisma.dog.create({
            data: {
              name: dogData.name,
              breed: dogData.breed || null,
              age: dogData.age || null,
              weight: dogData.weight || null,
              userId: user.id
            }
          })
        }
      }
    }

    // Create initial service visit record for scheduling
    if (servicePreferences) {
      await prisma.serviceVisit.create({
        data: {
          userId: user.id,
          scheduledDate: new Date(),
          serviceType: servicePreferences.serviceType === 'one-time' ? 'ONE_TIME' : 'REGULAR',
          yardSize: yardSize?.toUpperCase() || 'MEDIUM',
          dogsServiced: dogs?.length || 1,
          notes: `New signup: ${servicePreferences.serviceType}; Frequency: ${servicePreferences.frequency}; Preferred: ${servicePreferences.preferredDay} ${servicePreferences.preferredTime}${daysSinceLastClean ? `; Days since last clean: ${daysSinceLastClean}` : ''}`,
          status: 'SCHEDULED'
        }
      })
    }

    return NextResponse.json({
      message: 'Account created successfully',
      userId: user.id
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
