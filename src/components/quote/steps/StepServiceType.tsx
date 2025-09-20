"use client";

import React from "react";
import { useServiceTypeValidation } from "@/hooks/useFormValidation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Home } from "lucide-react";

import { track } from "@/lib/analytics";
import { StepProps } from "@/types/quote";
import {
  stepServiceTypeSchema,
  StepServiceTypeData,
} from "@/lib/validations/quote";

export const StepServiceType: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
}) => {
  const {
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useServiceTypeValidation(quoteData.serviceType);

  const handleServiceTypeSelect = async (
    serviceType: "residential" | "commercial",
  ) => {
    setValue("serviceType", serviceType);
    updateQuoteData({ serviceType });
    track("service_type_selected", { serviceType });
    onNext?.();
  };
  const onSubmit = async (data: {
    serviceType?: "residential" | "commercial";
  }) => {
    if (data.serviceType) {
      updateQuoteData({ serviceType: data.serviceType });
      track("service_type_selected", { serviceType: data.serviceType });
      onNext?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-4xl mx-auto space-y-6"
    >
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5 text-accent" />
            Service Type
          </CardTitle>
          <p className="text-muted">What type of service do you need?</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Residential Service */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer border-2 transition-all duration-200 hover:shadow-lg ${
                  quoteData.serviceType === "residential"
                    ? "border-accent bg-accent/5"
                    : "hover:border-accent border-gray-200"
                }`}
                onClick={() => handleServiceTypeSelect("residential")}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Home className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Residential</h3>
                  <p className="text-muted text-sm">
                    We clean up after your dog in your own yard. Perfect for
                    homes and apartments.
                  </p>
                  <div className="mt-4 text-xs text-muted">
                    Most popular choice
                  </div>
                  {quoteData.serviceType === "residential" && (
                    <div className="mt-2 text-accent font-medium">
                      ✓ Selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Commercial Service */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer border-2 transition-all duration-200 hover:shadow-lg ${
                  quoteData.serviceType === "commercial"
                    ? "border-accent bg-accent/5"
                    : "hover:border-accent border-gray-200"
                }`}
                onClick={() => handleServiceTypeSelect("commercial")}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Community</h3>
                  <p className="text-muted text-sm">
                    Pet waste stations and common-area cleanup for HOAs,
                    apartments, and businesses.
                  </p>
                  <div className="mt-4 text-xs text-muted">
                    Custom quote required
                  </div>
                  {quoteData.serviceType === "commercial" && (
                    <div className="mt-2 text-accent font-medium">
                      ✓ Selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Hidden submit button for form validation */}
          <button type="submit" className="hidden" />
        </CardContent>
      </Card>
    </form>
  );
};
