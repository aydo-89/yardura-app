import { NextRequest, NextResponse } from "next/server";
import {
  getBusinessConfig,
  registerBusinessConfig,
  updateBusinessConfig,
  BusinessConfig,
  validateBusinessConfig,
  exportBusinessConfig,
  importBusinessConfig,
  getRegisteredBusinesses,
} from "@/lib/business-config";

// GET /api/admin/business-config - Get all business configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (businessId) {
      // Get specific business config
      const config = await getBusinessConfig(businessId);
      return NextResponse.json({ config });
    } else {
      // Get all registered businesses
      const businesses = await getRegisteredBusinesses();
      const configs = await Promise.all(
        businesses.map(async (id: string) => ({
          id,
          config: await getBusinessConfig(id),
        })),
      );

      return NextResponse.json({ businesses: configs });
    }
  } catch (error) {
    console.error("Error fetching business configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch business configurations" },
      { status: 500 },
    );
  }
}

// POST /api/admin/business-config - Create or update business configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, config, action } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "create":
        if (!config) {
          return NextResponse.json(
            { error: "Configuration data is required for creation" },
            { status: 400 },
          );
        }

        // Validate the configuration
        const validation = validateBusinessConfig(config as BusinessConfig);
        if (!validation.valid) {
          return NextResponse.json(
            { error: "Invalid configuration", details: validation.errors },
            { status: 400 },
          );
        }

        await registerBusinessConfig(config as BusinessConfig);
        return NextResponse.json({
          message: "Business configuration created successfully",
          config: await getBusinessConfig(businessId),
        });

      case "update":
        if (!config) {
          return NextResponse.json(
            { error: "Configuration data is required for update" },
            { status: 400 },
          );
        }

        // Validate the configuration
        const updateValidation = validateBusinessConfig(
          config as BusinessConfig,
        );
        if (!updateValidation.valid) {
          return NextResponse.json(
            {
              error: "Invalid configuration",
              details: updateValidation.errors,
            },
            { status: 400 },
          );
        }

        await updateBusinessConfig(
          businessId,
          config as Partial<BusinessConfig>,
        );
        return NextResponse.json({
          message: "Business configuration updated successfully",
          config: await getBusinessConfig(businessId),
        });

      case "export":
        const exportedConfig = exportBusinessConfig(businessId);
        return NextResponse.json({
          config: exportedConfig,
          filename: `${businessId}-config-${new Date().toISOString().split("T")[0]}.json`,
        });

      case "import":
        if (!config) {
          return NextResponse.json(
            { error: "Configuration JSON is required for import" },
            { status: 400 },
          );
        }

        const importSuccess = importBusinessConfig(config as string);
        if (!importSuccess) {
          return NextResponse.json(
            { error: "Failed to import configuration" },
            { status: 400 },
          );
        }

        return NextResponse.json({
          message: "Business configuration imported successfully",
          config: getBusinessConfig(businessId),
        });

      default:
        return NextResponse.json(
          {
            error: "Invalid action. Must be create, update, export, or import",
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Error managing business config:", error);
    return NextResponse.json(
      { error: "Failed to manage business configuration" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/business-config - Delete business configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required" },
        { status: 400 },
      );
    }

    // Note: In a real implementation, you'd want to implement proper deletion
    // For now, we'll just reset to default
    const defaultConfig = await getBusinessConfig("yardura");
    await updateBusinessConfig(businessId, defaultConfig);

    return NextResponse.json({
      message: "Business configuration reset to default",
    });
  } catch (error) {
    console.error("Error deleting business config:", error);
    return NextResponse.json(
      { error: "Failed to delete business configuration" },
      { status: 500 },
    );
  }
}
