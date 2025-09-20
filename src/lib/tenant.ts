import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Resolve business/org ID from the request using multiple strategies
// Priority: explicit query param -> header -> subdomain/custom domain mapping -> default
export async function resolveBusinessId(request: NextRequest): Promise<string> {
  try {
    const url = new URL(request.url);

    // 1) Explicit query parameter override
    const qp = url.searchParams.get('businessId') || url.searchParams.get('org');
    if (qp) return qp;

    // 2) Header override (useful for server-to-server calls or embeds)
    const headerOrg = request.headers.get('x-org-id');
    if (headerOrg) return headerOrg;

    // 3) Host-based resolution (subdomain or custom domain mapping)
    const hostHeader = request.headers.get('host') || '';
    const host = hostHeader.split(':')[0]; // strip port

    // Local dev and single-tenant fallbacks
    if (!host || host === 'localhost') {
      return 'yardura';
    }

    const parts = host.split('.');

    // If we have a subdomain like org.yourapp.com
    if (parts.length >= 3) {
      const subdomain = parts[0];
      // Try to find an Org matching subdomain (id or slug if present)
      const org = await prisma.org.findFirst({
        where: {
          OR: [
            { id: subdomain },
            { slug: subdomain },
          ],
        },
        select: { id: true },
      });
      if (org) return org.id;
    }

    // Optional: custom domain mapping table (OrgDomain)
    // If such a table exists, uncomment and use it
    // const domainMapping = await prisma.orgDomain.findUnique({ where: { domain: host } });
    // if (domainMapping) return domainMapping.orgId;

    // 4) Default fallback
    return 'yardura';
  } catch (error) {
    console.error('resolveBusinessId error:', error);
    return 'yardura';
  }
}


