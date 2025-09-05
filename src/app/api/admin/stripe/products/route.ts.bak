import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

function isAdmin(email?: string | null) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return !!email && adminEmails.includes(email.toLowerCase())
}

export async function GET() {
  const session = await getServerSession(authOptions as any) as { user?: { email?: string } } | null
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const products = await stripe.products.list({ limit: 100, expand: ['data.default_price'] })
  return NextResponse.json(products.data)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions as any) as { user?: { email?: string } } | null
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, description } = body || {}
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const product = await stripe.products.create({ name, description })
  return NextResponse.json(product)
}


