import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Clock,
  TrendingUp,
  BarChart3,
  Palette,
  Activity,
  Users,
  Zap,
  X,
  Droplets,
} from "lucide-react";
import { wellnessTheme } from "@/shared/wellness";

interface ComingSoonOverlayProps {
  onJoinWaitlist: (email: string) => void;
  onClose?: () => void;
  closable?: boolean;
}

export const ComingSoonOverlay: React.FC<ComingSoonOverlayProps> = ({
  onJoinWaitlist,
  onClose,
  closable = true,
}) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onJoinWaitlist(email);
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="absolute inset-0 z-20 flex items-start justify-center p-6 pt-12"
      >
        {/* Semi-transparent background overlay */}
        <div
          className={`absolute inset-0 bg-white/30 backdrop-blur-[2px] rounded-lg ${
            closable ? "cursor-pointer" : ""
          }`}
          onClick={closable && onClose ? onClose : undefined}
          aria-label={closable ? "Close overlay" : undefined}
        />

        {/* Close button - only show if closable */}
        {closable && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2 rounded-full bg-white/80 hover:bg-white/90 transition-colors shadow-lg"
            aria-label="Close coming soon overlay"
          >
            <X className="size-4 text-slate-600" />
          </button>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ delay: 0.1 }}
          className="relative z-20 w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Card
            className="shadow-xl border-0"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: wellnessTheme.radiusLg,
              backdropFilter: "blur(10px)",
            }}
          >
            <CardContent className="p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-teal-50 to-blue-50 rounded-full border border-teal-200 mb-4"
                >
                  <Clock className="size-3.5 text-teal-600" />
                  <span className="text-xs font-medium text-teal-700">
                    Coming Soon
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-slate-900 mb-3"
                >
                  Advanced Pet Wellness Insights
                </motion.h1>

                <motion.p
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-slate-600 max-w-lg mx-auto"
                >
                  Get comprehensive health insights from your pet's waste
                  patterns. Monitor trends, receive personalized
                  recommendations, and stay ahead of potential health issues.
                </motion.p>
              </div>

              {/* Preview of Features */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-6"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
                  What You'll Get
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <TrendingUp className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Weekly Trends
                      </h4>
                      <p className="text-xs text-slate-600">
                        Track deposit frequency and patterns over time
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <Activity className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Consistency Analysis
                      </h4>
                      <p className="text-xs text-slate-600">
                        Bristol Stool Scale and weekly trends
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <Palette className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Color Analysis
                      </h4>
                      <p className="text-xs text-slate-600">
                        Detailed breakdown of waste colors and patterns
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <Droplets className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Content Signals
                      </h4>
                      <p className="text-xs text-slate-600">
                        Detect mucous, greasy, parasites, and foreign objects
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <TrendingUp className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Frequency Analysis
                      </h4>
                      <p className="text-xs text-slate-600">
                        Monitor deposit frequency patterns and consistency
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <Zap className="size-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        Smart Alerts
                      </h4>
                      <p className="text-xs text-slate-600">
                        Notifications about concerning health changes
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Waitlist Form */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Be the First to Know
                </h3>

                <p className="text-slate-600 mb-4 max-w-sm mx-auto text-sm">
                  Join our waitlist to get early access when we launch advanced
                  wellness insights.
                </p>

                {!isSubmitted ? (
                  <form onSubmit={handleSubmit} className="max-w-sm mx-auto">
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSubmitting || !email.trim()}
                        className="px-4 py-2.5 font-medium text-sm whitespace-nowrap"
                        style={{
                          backgroundColor: wellnessTheme.colors.teal,
                          borderRadius: wellnessTheme.radiusLg,
                        }}
                      >
                        {isSubmitting ? "Joining..." : "Join Waitlist"}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      We'll only send updates about the wellness feature.
                    </p>
                  </form>
                ) : (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-sm mx-auto"
                  >
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-green-600 text-center">
                        <Mail className="size-6 mx-auto mb-2" />
                        <h4 className="font-medium text-sm mb-1">
                          You're on the list!
                        </h4>
                        <p className="text-xs">
                          We'll notify you when advanced wellness insights are
                          available.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
