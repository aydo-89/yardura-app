import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
        submittedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Parse areasToClean if it's stored as JSON string
    let parsedAreasToClean = lead.areasToClean;
    if (typeof lead.areasToClean === 'string') {
      try {
        parsedAreasToClean = JSON.parse(lead.areasToClean);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    // Construct addOns object from individual fields
    const addOns = {
      deodorize: lead.deodorize,
      deodorizeMode: lead.deodorizeMode,
      sprayDeck: lead.sprayDeck,
      sprayDeckMode: lead.sprayDeckMode,
      divertMode: lead.divertMode,
    };

    return NextResponse.json({
      ...lead,
      addOns,
      areasToClean: parsedAreasToClean,
      createdAt: lead.submittedAt, // For backward compatibility
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
