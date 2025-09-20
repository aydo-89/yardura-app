import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Hook for zip code validation
export function useZipCodeValidation(defaultZipCode?: string) {
  return useForm({
    resolver: zodResolver(
      z.object({
        zipCode: z
          .string()
          .min(5, "ZIP code must be 5 digits")
          .max(10, "ZIP code must be 5 or 9 digits")
          .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
      }),
    ),
    defaultValues: {
      zipCode: defaultZipCode || "",
    },
    mode: "onChange",
  });
}

// Hook for service type validation
export function useServiceTypeValidation(
  defaultServiceType?: "residential" | "commercial",
) {
  return useForm({
    resolver: zodResolver(
      z.object({
        serviceType: z
          .enum(["residential", "commercial"], {
            message: "Please select a service type",
          })
          .optional(),
      }),
    ),
    defaultValues: {
      serviceType: defaultServiceType || undefined,
    },
    mode: "onChange",
  });
}

// Utility function to get validation errors as a formatted string
export function getValidationErrorMessage(error: unknown): string {
  if (!error) return "";

  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "Invalid input";
}

// Utility function to check if form has errors
export function hasFormErrors(errors: Record<string, unknown>): boolean {
  return Object.keys(errors).length > 0;
}

// Utility function to get field error message
export function getFieldError(
  errors: Record<string, unknown>,
  fieldName: string,
): string {
  const error = errors[fieldName];
  return error ? getValidationErrorMessage(error) : "";
}
