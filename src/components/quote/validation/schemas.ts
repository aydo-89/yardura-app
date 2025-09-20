import { z } from "zod";

// ZIP Check Step
export const ZipCheckSchema = z.object({
  zipCode: z
    .string()
    .min(5, "ZIP code must be 5 digits")
    .max(5, "ZIP code must be 5 digits")
    .regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code"),
});

// Contact Information Step
export const ContactInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
});

// Property Details Step
export const PropertyDetailsSchema = z.object({
  serviceType: z.enum(["residential", "commercial"]).refine((val) => val, {
    message: "Please select a service type",
  }),
  dogs: z.number().min(0, "Number of dogs must be 0 or more"),
  yardSize: z
    .enum(["small", "medium", "large", "xlarge"])
    .refine((val) => val, {
      message: "Please select a yard size",
    }),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(2, "Enter a valid city"),
  state: z.string().min(2, "Enter a valid state"),
  postalCode: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code"),
  zipCode: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code"),
  areasToClean: z.record(z.string(), z.boolean()),
});

// Service Frequency Step (residential only)
export const ServiceFrequencySchema = z.object({
  frequency: z
    .enum(["weekly", "bi-weekly", "twice-weekly", "monthly", "one-time"])
    .refine((val) => val, {
      message: "Please select a service frequency",
    }),
});

// Customization Step
export const CustomizationSchema = z.object({
  addOns: z
    .object({
      deodorize: z.boolean().optional(),
      deodorizeMode: z
        .enum(["first-visit", "each-visit", "every-other", "one-time"])
        .optional(),
      sprayDeck: z.boolean().optional(),
      sprayDeckMode: z
        .enum(["first-visit", "each-visit", "every-other", "one-time"])
        .optional(),
      divertMode: z.enum(["none", "takeaway", "25", "50", "100"]).optional(),
      litter: z.boolean().optional(),
    })
    .optional(),
  wellnessOptIn: z.boolean().optional(),
});

// Commercial Contact Step
export const CommercialContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  businessName: z.string().min(1, "Business name is required"),
  businessType: z.string().min(1, "Select a business type"),
});

// Step validation result type
export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string[]>;
  issues: Record<string, string[]>;
  firstInvalidKey?: string;
  firstError?: string;
};

// Step validation function
export function validateStep(stepId: string, data: any): ValidationResult {
  try {
    let schema: z.ZodSchema;

    switch (stepId) {
      case "zip-check":
        schema = ZipCheckSchema;
        break;
      case "contact-info":
        schema = ContactInfoSchema;
        break;
      case "property-details":
        schema = PropertyDetailsSchema;
        break;
      case "frequency":
        schema = ServiceFrequencySchema;
        break;
      case "customization":
        schema = CustomizationSchema;
        break;
      case "commercial-contact":
        schema = CommercialContactSchema;
        break;
      default:
        return { valid: true, errors: {}, issues: {} };
    }

    const result = schema.safeParse(data);

    if (result.success) {
      return { valid: true, errors: {}, issues: {} };
    } else {
      const errors: Record<string, string[]> = {};
      const issues: Record<string, string[]> = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path.join(".");
        if (!errors[field]) {
          errors[field] = [];
        }
        if (!issues[field]) {
          issues[field] = [];
        }
        errors[field].push(issue.message);
        issues[field].push(issue.message);
      });

      const firstInvalidKey = result.error.issues[0]?.path.join(".") || "";
      const firstError = result.error.issues[0]?.message || "Validation failed";

      return { valid: false, errors, issues, firstInvalidKey, firstError };
    }
  } catch (error) {
    console.error("Validation error:", error);
    return {
      valid: false,
      errors: { general: ["An unexpected validation error occurred"] },
      issues: { general: ["An unexpected validation error occurred"] },
      firstError: "An unexpected validation error occurred",
    };
  }
}

/**
 * Validate a single field in real-time
 */
export function validateField(
  stepId: string,
  fieldName: string,
  value: any,
  allData: any,
): { valid: boolean; error?: string } {
  try {
    let schema: z.ZodSchema;

    switch (stepId) {
      case "zip-check":
        if (fieldName === "zipCode") {
          schema = z
            .string()
            .min(5, "ZIP code must be 5 digits")
            .max(5, "ZIP code must be 5 digits")
            .regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code");
        } else {
          return { valid: true };
        }
        break;
      case "contact-info":
        if (fieldName === "firstName") {
          schema = z.string().min(1, "First name is required");
        } else if (fieldName === "lastName") {
          schema = z.string().min(1, "Last name is required");
        } else if (fieldName === "email") {
          schema = z.string().email("Enter a valid email address");
        } else if (fieldName === "phone") {
          schema = z.string().min(10, "Enter a valid phone number");
        } else {
          return { valid: true };
        }
        break;
      case "property-details":
        if (fieldName === "serviceType") {
          schema = z.enum(["residential", "commercial"]);
        } else if (fieldName === "dogs") {
          schema = z.number().min(0, "Number of dogs must be 0 or more");
        } else if (fieldName === "yardSize") {
          schema = z.enum(["small", "medium", "large", "xlarge"]);
        } else if (fieldName === "address") {
          schema = z.string().min(1, "Address is required");
        } else if (fieldName === "city") {
          schema = z.string().min(2, "Enter a valid city");
        } else if (fieldName === "state") {
          schema = z.string().min(2, "Enter a valid state");
        } else if (fieldName === "zipCode") {
          schema = z
            .string()
            .regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code");
        } else {
          return { valid: true };
        }
        break;
      case "frequency":
        if (fieldName === "frequency") {
          schema = z.enum([
            "weekly",
            "bi-weekly",
            "twice-weekly",
            "monthly",
            "one-time",
          ]);
        } else {
          return { valid: true };
        }
        break;
      case "commercial-contact":
        if (fieldName === "firstName") {
          schema = z.string().min(1, "First name is required");
        } else if (fieldName === "lastName") {
          schema = z.string().min(1, "Last name is required");
        } else if (fieldName === "email") {
          schema = z.string().email("Enter a valid email address");
        } else if (fieldName === "phone") {
          schema = z.string().min(10, "Enter a valid phone number");
        } else if (fieldName === "businessName") {
          schema = z.string().min(1, "Business name is required");
        } else if (fieldName === "businessType") {
          schema = z.string().min(1, "Select a business type");
        } else {
          return { valid: true };
        }
        break;
      default:
        return { valid: true };
    }

    const result = schema.safeParse(value);

    if (result.success) {
      return { valid: true };
    } else {
      const errorMessage = result.error.issues[0]?.message || "Invalid value";
      return { valid: false, error: errorMessage };
    }
  } catch (error) {
    console.error("Field validation error:", error);
    return { valid: true }; // Don't block users for validation errors
  }
}
