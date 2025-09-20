'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building } from 'lucide-react';
import { StepProps } from '@/types/quote';

export const StepCommercialContact: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  _errors,
  _estimatedPrice,
  onNext,
}) => {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-slate-50/20 to-blue-50/20 min-h-[600px]">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-slate-500 rounded-lg">
              <Building className="size-6 text-white" />
            </div>
            Commercial Property Contact
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            Provide your contact details for a personalized commercial quote
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-800 mb-2">Custom Commercial Quote</p>
                <p className="text-blue-700 leading-relaxed">
                  Commercial properties require personalized pricing based on property size, usage
                  patterns, and specific needs. We'll contact you within 24 hours with a detailed
                  quote.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-base font-semibold">
                Contact Name *
              </Label>
              <Input
                id="contactName"
                type="text"
                value={quoteData.contact?.name || ''}
                onChange={(e) =>
                  updateQuoteData({ contact: { ...quoteData.contact, name: e.target.value } })
                }
                placeholder="Your full name"
                className="h-12 text-base border-2 focus:border-blue-400"
              />
              {_errors?.contact && _errors.contact.length > 0 && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 font-medium"
                >
                  {_errors.contact[0]}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactTitle" className="text-base font-semibold">
                Job Title
              </Label>
              <Input
                id="contactTitle"
                type="text"
                value={quoteData.contact?.title || ''}
                onChange={(e) =>
                  updateQuoteData({ contact: { ...quoteData.contact, title: e.target.value } })
                }
                placeholder="Property manager, owner, etc."
                className="h-12 text-base border-2 focus:border-blue-400"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-base font-semibold">
                Email Address *
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={quoteData.contact?.email || ''}
                onChange={(e) =>
                  updateQuoteData({ contact: { ...quoteData.contact, email: e.target.value } })
                }
                placeholder="your@email.com"
                className="h-12 text-base border-2 focus:border-blue-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="text-base font-semibold">
                Phone Number *
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                value={quoteData.contact?.phone || ''}
                onChange={(e) =>
                  updateQuoteData({ contact: { ...quoteData.contact, phone: e.target.value } })
                }
                placeholder="(555) 123-4567"
                className="h-12 text-base border-2 focus:border-blue-400"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <Label htmlFor="commercialNotes" className="text-base font-semibold">
              Additional Details
            </Label>
            <Textarea
              id="commercialNotes"
              value={quoteData.commercialNotes || ''}
              onChange={(e) => updateQuoteData({ commercialNotes: e.target.value })}
              placeholder="Tell us about your property - number of units, daily usage, special requirements, etc."
              className="min-h-[120px] text-base border-2 focus:border-blue-400 resize-none"
            />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
};