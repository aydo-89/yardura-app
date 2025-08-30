import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Users, TrendingUp, UserPlus } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sales Rep Dashboard • Yardura',
}

export default async function SalesRepDashboard() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/signin')
  }

  // Check if user is a sales rep
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, commissionRate: true }
  })

  if (!user || user.role !== UserRole.SALES_REP) {
    redirect('/dashboard')
  }

  // Get commission data
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

  // Calculate stats
  const totalEarned = commissions
    .filter(c => c.status === 'PAID')
    .reduce((sum, c) => sum + c.amount, 0)

  const pendingAmount = commissions
    .filter(c => c.status === 'PENDING')
    .reduce((sum, c) => sum + c.amount, 0)

  const totalCustomers = await prisma.user.count({
    where: { salesRepId: session.user.id }
  })

  const recentCommissions = commissions.slice(0, 5)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
        <p className="text-gray-600 mt-2">Track your referrals and commissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarned.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((user.commissionRate || 0) * 100).toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Customer Signups</CardTitle>
            <CardDescription>Create new customer accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <a href="/sales-rep/customer-signup">Create Customer Account</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission Report</CardTitle>
            <CardDescription>View detailed commission history</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <a href="/sales-rep/commissions">View Report</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Commissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commissions</CardTitle>
          <CardDescription>Your latest commission earnings</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCommissions.length > 0 ? (
            <div className="space-y-4">
              {recentCommissions.map((commission) => (
                <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{commission.customer.name}</span>
                      <Badge variant={commission.status === 'PAID' ? 'default' : 'secondary'}>
                        {commission.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {commission.customer.city} • {commission.serviceVisit.serviceType} • {commission.serviceVisit.dogsServiced} dog{commission.serviceVisit.dogsServiced !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {commission.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">${commission.amount.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No commissions yet. Start by signing up customers!</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


