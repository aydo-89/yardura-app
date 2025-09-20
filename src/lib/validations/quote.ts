import { z } from "zod";

// Base validation schemas
export const zipCodeSchema = z
  .string()
  .min(5, "ZIP code must be 5 digits")
  .max(10, "ZIP code must be 5 or 9 digits")
  .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format");

export const serviceTypeSchema = z.enum(["residential", "commercial"], {
  message: "Please select a service type",
});

export const propertyTypeSchema = z.enum(["residential", "commercial"], {
  message: "Please select a property type",
});

export const yardSizeSchema = z.enum(["small", "medium", "large", "xl"], {
  message: "Please select a yard size",
});

export const frequencySchema = z.enum(
  ["weekly", "biweekly", "twice-weekly", "monthly", "one-time"],
  {
    message: "Please select a service frequency",
  },
);

export const dogsSchema = z
  .number()
  .min(1, "At least 1 dog required")
  .max(10, "Maximum 10 dogs supported");

export const addressSchema = z
  .string()
  .min(5, "Address must be at least 5 characters")
  .max(200, "Address must be less than 200 characters");

export const firstNameSchema = z
  .string()
  .min(2, "First name must be at least 2 characters")
  .max(50, "First name must be less than 50 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "First name contains invalid characters");

export const lastNameSchema = z
  .string()
  .min(2, "Last name must be at least 2 characters")
  .max(50, "Last name must be less than 50 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Last name contains invalid characters");

export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .max(100, "Email must be less than 100 characters");

export const phoneSchema = z
  .string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number")
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number must be less than 15 digits");

export const businessTypeSchema = z
  .string()
  .min(2, "Business type must be at least 2 characters")
  .max(100, "Business type must be less than 100 characters");

export const specialInstructionsSchema = z
  .string()
  .max(500, "Special instructions must be less than 500 characters")
  .optional();

export const referralSourceSchema = z
  .string()
  .max(100, "Referral source must be less than 100 characters")
  .optional();

// Step-specific validation schemas
export const stepZipCheckSchema = z.object({
  zipCode: zipCodeSchema,
});

export const stepServiceTypeSchema = z.object({
  serviceType: serviceTypeSchema,
});

export const stepBasicsSchema = z.object({
  propertyType: propertyTypeSchema,
  dogs: dogsSchema,
  yardSize: yardSizeSchema,
  address: addressSchema,
});

export const stepFrequencySchema = z.object({
  frequency: frequencySchema,
});

export const stepCommercialContactSchema = z.object({
  businessType: businessTypeSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  specialInstructions: specialInstructionsSchema,
  referralSource: referralSourceSchema,
});

export const stepContactReviewSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  specialInstructions: specialInstructionsSchema,
  referralSource: referralSourceSchema,
});

// Complete quote validation schema
export const completeQuoteSchema = z.object({
  zipCode: zipCodeSchema,
  serviceType: serviceTypeSchema,
  propertyType: propertyTypeSchema,
  dogs: dogsSchema,
  yardSize: yardSizeSchema,
  frequency: frequencySchema,
  address: addressSchema,
  businessType: businessTypeSchema.optional(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  specialInstructions: specialInstructionsSchema,
  referralSource: referralSourceSchema,
});

// Type inference
export type StepZipCheckData = z.infer<typeof stepZipCheckSchema>;
export type StepServiceTypeData = z.infer<typeof stepServiceTypeSchema>;
export type StepBasicsData = z.infer<typeof stepBasicsSchema>;
export type StepFrequencyData = z.infer<typeof stepFrequencySchema>;
export type StepCommercialContactData = z.infer<
  typeof stepCommercialContactSchema
>;
export type StepContactReviewData = z.infer<typeof stepContactReviewSchema>;
export type CompleteQuoteData = z.infer<typeof completeQuoteSchema>;
