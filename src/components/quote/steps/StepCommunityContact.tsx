"use client";

import React from "react";
import { motion } from "@/lib/framermotion";
import { Building } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StepProps } from "@/types/quote";
import { formatPhoneNumber, cn } from "@/lib/utils";
import {
  withQuotePanel,
  quoteSubtleTextClass,
  quoteFieldLabelClass,
  quoteInputClass,
  quoteSurfaceClass,
  quoteHeadingClass,
} from "../quoteStyles";

export const StepCommunityContact: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  _errors,
}) => {
  return (
    <div className="space-y-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-3 font-serif text-xl font-normal md:text-2xl text-brand-ink dark:text-cream-vanilla">
            <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-900 dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <Building className="size-6" />
            </div>
            Community & Shared Spaces
          </CardTitle>
          <p className={cn("text-sm md:text-base", quoteSubtleTextClass)}>
            Share your info and a few details about the space. Our team will reach out within one business day with options that fit your community.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              quoteSurfaceClass,
              "border border-brand-coral/30 bg-brand-coral/8 p-4 text-sm text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
            )}
          >
            We tailor pricing around resident count, shared spaces, and visit frequency. A quick conversation helps us build the right playbook — zero obligation.
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="communityContactName" className={cn("text-sm font-semibold", quoteFieldLabelClass)}>
                Contact name *
              </Label>
              <Input
                id="communityContactName"
                value={quoteData.contact?.name || ""}
                onChange={(e) =>
                  updateQuoteData({
                    contact: { ...quoteData.contact, name: e.target.value },
                  })
                }
                placeholder="Your full name"
                className={cn(quoteInputClass, "h-11 text-sm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="communityContactTitle" className={cn("text-sm font-semibold", quoteFieldLabelClass)}>
                Role / title
              </Label>
              <Input
                id="communityContactTitle"
                value={quoteData.contact?.title || ""}
                onChange={(e) =>
                  updateQuoteData({
                    contact: { ...quoteData.contact, title: e.target.value },
                  })
                }
                placeholder="Property manager, HOA board, etc."
                className={cn(quoteInputClass, "h-11 text-sm")}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="communityContactEmail" className={cn("text-sm font-semibold", quoteFieldLabelClass)}>
                Email *
              </Label>
              <Input
                id="communityContactEmail"
                type="email"
                value={quoteData.contact?.email || ""}
                onChange={(e) =>
                  updateQuoteData({
                    contact: { ...quoteData.contact, email: e.target.value },
                  })
                }
                placeholder="you@example.com"
                className={cn(quoteInputClass, "h-11 text-sm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="communityContactPhone" className={cn("text-sm font-semibold", quoteFieldLabelClass)}>
                Phone *
              </Label>
              <Input
                id="communityContactPhone"
                type="tel"
                value={formatPhoneNumber(quoteData.contact?.phone || "")}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  updateQuoteData({
                    contact: { ...quoteData.contact, phone: formatted },
                  });
                }}
                placeholder="(555) 123-4567"
                className={cn(quoteInputClass, "h-11 text-sm")}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
            <Label htmlFor="communityNotes" className={cn("text-sm font-semibold", quoteFieldLabelClass)}>
              Tell us about the space
            </Label>
            <Textarea
              id="communityNotes"
              value={quoteData.commercialNotes || ""}
              onChange={(e) => updateQuoteData({ commercialNotes: e.target.value })}
              placeholder="Approximate number of residents, shared lawn size, pet stations, preferred service days, or anything helpful."
              className={cn(quoteInputClass, "min-h-[110px] resize-none text-sm")}
            />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
};
