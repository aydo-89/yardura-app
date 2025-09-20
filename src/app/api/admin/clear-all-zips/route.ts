import { NextRequest, NextResponse } from 'next/server';
import { getBusinessConfig } from '@/lib/business-config';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { businessId } = await req.json();
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    console.log(`Clearing all ZIP codes for business: ${businessId}`);

    // Get current business config
    const currentConfig = await getBusinessConfig(businessId);
    
    if (!currentConfig) {
      return NextResponse.json(
        { error: 'Business configuration not found' },
        { status: 404 }
      );
    }

    // Reset service zones to empty
    const updatedConfig = {
      ...currentConfig,
      serviceZones: [] // Clear all service zones
    };

    // Update the database
    await prisma.businessConfig.upsert({
      where: { orgId: businessId },
      update: {
        serviceZones: updatedConfig.serviceZones,
        updatedAt: new Date()
      },
      create: {
        orgId: businessId,
        businessName: 'Yardura',
        serviceZones: [],
        basePricing: {},
        settings: {},
        operations: {},
        communication: {},
      }
    });

    console.log(`Successfully cleared all ZIP codes for business: ${businessId}`);

    return NextResponse.json({
      success: true,
      message: 'All ZIP codes have been cleared',
      clearedZips: currentConfig.serviceZones?.length || 0
    });

  } catch (error) {
    console.error('Failed to clear ZIP codes:', error);
    return NextResponse.json(
      { error: 'Failed to clear ZIP codes' },
      { status: 500 }
    );
  }
}
