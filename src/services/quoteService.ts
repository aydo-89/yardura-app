import { QuoteData, PricingData } from "@/types/quote";
import { calculatePrice, QuoteInput } from "@/lib/priceEstimator";

export class QuoteService {
  static async calculatePricing(quoteData: QuoteData): Promise<PricingData> {
    try {
      const quoteInput: QuoteInput = {
        zipCode: quoteData.zipCode || "",
        serviceType: quoteData.serviceType,
        dogs: quoteData.dogs || 1,
        yardSize: quoteData.yardSize || "medium",
        frequency: (quoteData.frequency as any) || "weekly",
        propertyType: quoteData.propertyType,
        businessType: quoteData.businessType,
        serviceFrequency: quoteData.serviceFrequency,
        address: quoteData.address,
        addOns: quoteData.addOns,
        lastCleanedBucket: quoteData.lastCleanedBucket,
        initialClean: quoteData.initialClean,
      };

      const pricing = await calculatePrice(quoteInput);

      return {
        basePrice: (pricing as any).breakdown?.basePrice,
        frequency: quoteData.frequency,
        serviceType: quoteData.serviceType,
        addOns: (pricing as any).breakdown?.addOnCents
          ? [
              {
                name: "Service Add-ons",
                price: (pricing as any).breakdown.addOnCents / 100 || 0,
              },
            ]
          : [],
        totalPrice: pricing.total,
        requiresCustomQuote: pricing.requiresCustomQuote || false,
        commercialMessage: (pricing as any).commercialMessage,
      };
    } catch (error) {
      console.error("Error calculating pricing:", error);
      throw new Error("Failed to calculate pricing");
    }
  }

  static async validateQuoteData(
    quoteData: QuoteData,
  ): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};

    // Basic validation rules
    if (!quoteData.zipCode?.trim()) {
      errors.zipCode = "ZIP code is required";
    } else if (!/^\d{5}(-\d{4})?$/.test(quoteData.zipCode)) {
      errors.zipCode = "Please enter a valid ZIP code";
    }

    if (!quoteData.serviceType?.trim()) {
      errors.serviceType = "Service type is required";
    }

    if (!quoteData.frequency?.trim()) {
      errors.frequency = "Service frequency is required";
    }

    // Contact validation for later steps
    if (quoteData.firstName && quoteData.firstName.length < 2) {
      errors.firstName = "First name must be at least 2 characters";
    }

    if (quoteData.lastName && quoteData.lastName.length < 2) {
      errors.lastName = "Last name must be at least 2 characters";
    }

    if (
      quoteData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quoteData.email)
    ) {
      errors.email = "Please enter a valid email address";
    }

    if (
      quoteData.phone &&
      !/^\+?[\d\s\-\(\)]{10,}$/.test(quoteData.phone.replace(/\s/g, ""))
    ) {
      errors.phone = "Please enter a valid phone number";
    }

    return errors;
  }

  static async submitQuote(
    quoteData: QuoteData,
  ): Promise<{ success: boolean; quoteId?: string; error?: string }> {
    try {
      const response = await fetch("/api/quote/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quoteData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit quote");
      }

      return {
        success: true,
        quoteId: result.quoteId,
      };
    } catch (error) {
      console.error("Error submitting quote:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  static async getServiceOptions(): Promise<any[]> {
    // This would typically fetch from an API or database
    // For now, return static options
    return [
      { value: "basic-lawn-care", label: "Basic Lawn Care" },
      { value: "premium-lawn-care", label: "Premium Lawn Care" },
      { value: "seasonal-cleanup", label: "Seasonal Cleanup" },
      { value: "landscaping", label: "Landscaping" },
    ];
  }

  static async getFrequencyOptions(): Promise<any[]> {
    return [
      { value: "weekly", label: "Weekly" },
      { value: "biweekly", label: "Every Other Week" },
      { value: "monthly", label: "Monthly" },
      { value: "seasonal", label: "Seasonal" },
    ];
  }

  static async getAddOnOptions(): Promise<any[]> {
    return [
      { value: "fertilizer", label: "Fertilizer Application" },
      { value: "pest-control", label: "Pest Control" },
      { value: "weed-control", label: "Weed Control" },
      { value: "aeration", label: "Lawn Aeration" },
    ];
  }
}
