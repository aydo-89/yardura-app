import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const globalStats = await prisma.globalStats.findUnique({
      where: { id: 'global' }
    })

    if (!globalStats) {
      // Initialize global stats if they don't exist
      const newStats = await prisma.globalStats.create({
        data: {
          id: 'global',
          totalWasteDiverted: 0,
          totalMethaneAvoided: 0,
          totalUsers: 0,
          totalDogs: 0,
          totalServiceVisits: 0
        }
      })

      return NextResponse.json({
        totalWasteDiverted: Math.round(newStats.totalWasteDiverted),
        totalMethaneAvoided: Math.round(newStats.totalMethaneAvoided),
        totalUsers: newStats.totalUsers,
        totalDogs: newStats.totalDogs,
        totalServiceVisits: newStats.totalServiceVisits
      })
    }

    return NextResponse.json({
      totalWasteDiverted: Math.round(globalStats.totalWasteDiverted),
      totalMethaneAvoided: Math.round(globalStats.totalMethaneAvoided),
      totalUsers: globalStats.totalUsers,
      totalDogs: globalStats.totalDogs,
      totalServiceVisits: globalStats.totalServiceVisits
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


