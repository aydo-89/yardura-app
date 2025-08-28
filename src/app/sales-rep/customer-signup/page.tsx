import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import CustomerSignupForm from '@/components/sales-rep/CustomerSignupForm'

export const metadata: Metadata = {
  title: 'Create Customer Account • Yardura',
}

export default async function CustomerSignupPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/signin')
  }

  // Check if user is a sales rep
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  if (!user || user.role !== UserRole.SALES_REP) {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Customer Account</h1>
          <p className="text-gray-600 mt-2">Sign up a new customer and earn commissions on their service visits.</p>
        </div>

        <CustomerSignupForm />
      </div>
    </div>
  )
}
