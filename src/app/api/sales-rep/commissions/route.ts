import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, CommissionStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a sales rep
    const salesRep = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!salesRep || salesRep.role !== UserRole.SALES_REP) {
      return NextResponse.json(
        { error: 'Only sales reps can view commissions' },
        { status: 403 }
      )
    }

    // Get all commissions for this sales rep
    const commissions = await prisma.commission.findMany({
      where: { salesRepId: session.user.id },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            city: true
          }
        },
        serviceVisit: {
          select: {
            completedDate: true,
            serviceType: true,
            dogsServiced: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate summary statistics
    const totalEarned = commissions
      .filter(c => c.status === CommissionStatus.PAID)
      .reduce((sum, c) => sum + c.amount, 0)

    const pendingAmount = commissions
      .filter(c => c.status === CommissionStatus.PENDING)
      .reduce((sum, c) => sum + c.amount, 0)

    const totalCustomers = new Set(commissions.map(c => c.customerId)).size

    return NextResponse.json({
      commissions,
      summary: {
        totalEarned,
        pendingAmount,
        totalCommissions: commissions.length,
        totalCustomers
      }
    })

  } catch (error) {
    console.error('Commissions fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


