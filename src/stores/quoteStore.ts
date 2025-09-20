import { create } from "zustand";
import { persist } from "zustand/middleware";
import { QuoteData, PricingData, QuoteState } from "@/types/quote";

interface QuoteStore extends QuoteState {
  // Actions
  setCurrentStep: (step: number) => void;
  updateQuoteData: (updates: Partial<QuoteData>) => void;
  setPricing: (pricing: PricingData | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  reset: () => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
}

const initialQuoteData: QuoteData = {
  zipCode: "",
  serviceType: undefined,
  dogs: 1,
  yardSize: "medium",
  frequency: "weekly",
  propertyType: undefined,
  businessType: "",
  serviceFrequency: "",
  address: "",
  addOns: undefined,
  lastCleanedBucket: "",
  initialClean: false,
  daysSinceLastCleanup: 14,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  specialInstructions: "",
  referralSource: "",
  preferredContactMethod: "email",
};

const initialState: QuoteState = {
  currentStep: 0,
  quoteData: initialQuoteData,
  pricing: null,
  isSubmitting: false,
  errors: {},
};

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step: number) => set({ currentStep: step }),

      updateQuoteData: (updates: Partial<QuoteData>) =>
        set((state) => ({
          quoteData: { ...state.quoteData, ...updates },
        })),

      setPricing: (pricing: PricingData | null) => set({ pricing }),

      setSubmitting: (isSubmitting: boolean) => set({ isSubmitting }),

      setError: (field: string, error: string) =>
        set((state) => ({
          errors: { ...state.errors, [field]: error },
        })),

      clearError: (field: string) =>
        set((state) => {
          const newErrors = { ...state.errors };
          delete newErrors[field];
          return { errors: newErrors };
        }),

      clearAllErrors: () => set({ errors: {} }),

      reset: () => set(initialState),

      goToNextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, 10), // Assuming max 11 steps
        })),

      goToPreviousStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),
    }),
    {
      name: "yardura-quote-storage",
      partialize: (state) => ({
        quoteData: state.quoteData,
        currentStep: state.currentStep,
      }),
    },
  ),
);

// Selectors for commonly used state
export const useQuoteData = () => useQuoteStore((state) => state.quoteData);
export const useCurrentStep = () => useQuoteStore((state) => state.currentStep);
export const usePricing = () => useQuoteStore((state) => state.pricing);
export const useQuoteErrors = () => useQuoteStore((state) => state.errors);
export const useIsSubmitting = () =>
  useQuoteStore((state) => state.isSubmitting);
