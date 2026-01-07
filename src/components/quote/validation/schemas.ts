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
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => {
      if (!value) return true;
      return value.replace(/\D/g, "").length >= 10;
    }, "Enter a valid phone number"),
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
    .enum(["weekly", "biweekly", "twice-weekly", "daily", "monthly", "onetime"])
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
        .enum(["first-visit", "each-visit", "one-time"])
        .optional(),
      sprayDeck: z.boolean().optional(),
      sprayDeckMode: z
        .enum(["first-visit", "each-visit", "every-other", "one-time"])
        .optional(),
      divertMode: z.enum(["none", "takeaway", "compost"]).optional(),
      litter: z.boolean().optional(),
    })
    .optional(),
  wellnessOptIn: z.boolean().optional(),
});

// Community Contact Step
export const CommunityContactSchema = z.object({
  contact: z.object({
    name: z.string().min(1, "Contact name is required"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().min(10, "Enter a valid phone number"),
    title: z.string().optional(),
  }),
  commercialNotes: z.string().optional(),
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactReview(data: any): ValidationResult {
  const errors: Record<string, string[]> = {};

  const pushError = (key: string, message: string) => {
    if (!errors[key]) {
      errors[key] = [];
    }
    errors[key].push(message);
  };

  const address = typeof data.address === "string" ? data.address.trim() : "";
  if (!address) {
    pushError("address", "Please enter your complete service address");
  }

  const contactName = data.contact?.name?.trim?.();
  if (!contactName) {
    pushError("contact.name", "Please enter your full name");
  }

  const contactEmail = data.contact?.email?.trim?.();
  if (!contactEmail) {
    pushError("contact.email", "Please enter your email address");
  } else if (!emailRegex.test(contactEmail)) {
    pushError("contact.email", "Please enter a valid email address");
  }

  const contactPhoneDigits = (data.contact?.phone || "").replace(/\D/g, "");
  if (contactPhoneDigits && contactPhoneDigits.length < 10) {
    pushError("contact.phone", "Please enter a valid phone number");
  }

  if (data.consent?.terms !== true) {
    pushError(
      "consent.terms",
      "Please confirm you agree to the Privacy Policy",
    );
  }

  const isValid = Object.keys(errors).length === 0;
  const issues = Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, [...value]]),
  );
  const firstInvalidKey = Object.keys(errors)[0];

  return {
    valid: isValid,
    errors,
    issues,
    firstInvalidKey,
    firstError: firstInvalidKey ? errors[firstInvalidKey][0] : undefined,
  };
}

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
      case "community-contact":
        schema = CommunityContactSchema;
        break;
      case "contact-review":
        return validateContactReview(data);
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
            "daily",
            "monthly",
            "one-time",
          ]);
        } else {
          return { valid: true };
        }
        break;
      case "community-contact":
        if (fieldName === "contact.name") {
          schema = z.string().min(1, "Contact name is required");
        } else if (fieldName === "contact.email") {
          schema = z.string().email("Enter a valid email address");
        } else if (fieldName === "contact.phone") {
          schema = z.string().min(10, "Enter a valid phone number");
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
