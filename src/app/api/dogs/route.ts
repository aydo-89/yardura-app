import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, breed, age, weight } = await request.json()

    const dog = await prisma.dog.create({
      data: {
        name,
        breed,
        age,
        weight: weight ? parseFloat(weight) : null,
        userId: session.user.id
      }
    })

    return NextResponse.json({ dog })
  } catch (error) {
    console.error('Error creating dog:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dogs = await prisma.dog.findMany({
      where: { userId: session.user.id },
      include: {
        dataReadings: {
          orderBy: { timestamp: 'desc' },
          take: 5
        }
      }
    })

    return NextResponse.json({ dogs })
  } catch (error) {
    console.error('Error fetching dogs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


