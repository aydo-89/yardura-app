'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Sparkles, Droplets, Recycle, CheckCircle, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { StepProps } from '@/types/quote';
import { AddOnConfig } from '@/lib/business-config';

interface CustomizationOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  price: string;
  selected: boolean;
  onClick: () => void;
}

export const StepCustomization: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
}) => {
  const [availableAddOns, setAvailableAddOns] = useState<AddOnConfig[]>([]);
  const [businessConfig, setBusinessConfig] = useState<any>(null);
  const [addonModes, setAddonModes] = useState<Record<string, string>>({});

  // Load business config from public API (server-side fetch)
  const loadConfig = async (forceRefresh = false) => {
    try {
      const timestamp = forceRefresh ? `?_=${Date.now()}` : '';
      const res = await fetch(`/api/business-config${timestamp}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch business config: ${res.status}`);
      const { config } = await res.json();

      console.log('StepCustomization loaded config for orgId: yardura');
      console.log('Pricing loaded - deodorize:', config.basePricing.addOns.find((a: any) => a.id === 'deodorize')?.priceCents, 'spray-deck:', config.basePricing.addOns.find((a: any) => a.id === 'spray-deck')?.priceCents, 'litter:', config.basePricing.addOns.find((a: any) => a.id === 'litter')?.priceCents);

      setBusinessConfig(config);
      // Filter out spray-deck and litter completely
      setAvailableAddOns(
        config.basePricing.addOns.filter((addon: AddOnConfig) => addon.available && addon.id !== 'spray-deck' && addon.id !== 'litter')
      );

      // Initialize addon modes from quoteData for all available add-ons
      const modes: Record<string, string> = {};
      config.basePricing.addOns
        .filter((addon: AddOnConfig) => addon.available && addon.id !== 'spray-deck' && addon.id !== 'litter')
        .forEach((addon: AddOnConfig) => {
          // Handle special cases for diversion add-ons
          if (addon.id.startsWith('divert-')) {
            if (addon.id === 'divert-takeaway') {
              modes[addon.id] = quoteData?.addOns?.divertMode === 'takeaway' ? 'selected' : 'none';
            } else if (addon.id === 'divert-25') {
              modes[addon.id] = quoteData?.addOns?.divertMode === '25' ? 'selected' : 'none';
            } else if (addon.id === 'divert-50') {
              modes[addon.id] = quoteData?.addOns?.divertMode === '50' ? 'selected' : 'none';
            } else if (addon.id === 'divert-100') {
              modes[addon.id] = quoteData?.addOns?.divertMode === '100' ? 'selected' : 'none';
            }
          } else {
            // For regular add-ons, check if they have a mode
            const modeKey = `${addon.id}Mode`;
            const addonEnabled = (quoteData?.addOns as any)?.[addon.id];
            const addonMode = (quoteData?.addOns as any)?.[modeKey];
            
            if (addonEnabled && addonMode) {
              modes[addon.id] = addonMode;
            } else {
              modes[addon.id] = 'none';
            }
          }
        });

      setAddonModes(modes);
    } catch (error) {
      console.error('Failed to load business config:', error);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [quoteData]);

  // Force reload config on mount
  useEffect(() => {
    loadConfig(true);
  }, []);

  // Reload config when window gains focus or becomes visible (in case user changed pricing in admin)
  useEffect(() => {
    const handleFocus = () => loadConfig(true);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadConfig(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Helper function to calculate add-on pricing display
  const calculateAddonPrice = (addon: AddOnConfig, billingMode: string, frequency: string = 'weekly') => {
    let priceCents = addon.priceCents;

    // Calculate the actual cost based on billing mode
    if (billingMode === 'every-other') {
      priceCents = Math.round(priceCents / 2);
    } else if (billingMode === 'first-visit' && frequency !== 'one-time') {
      // For recurring services, first-visit shows as one-time cost but $0/visit for recurring
      const price = (priceCents / 100).toFixed(2);
      return `+$${price} one-time`;
    } else if (billingMode === 'one-time' && frequency !== 'one-time') {
      // For recurring services, one-time shows as $0/visit
      const price = (priceCents / 100).toFixed(2);
      return `+$${price} one-time`;
    }

    const price = (priceCents / 100).toFixed(2);

    if (billingMode === 'first-visit' || billingMode === 'one-time') {
      return `+$${price} one-time`;
    } else if (billingMode === 'every-other') {
      return `+$${price}/visit`;
    } else {
      return `+$${price}/visit`;
    }
  };

  // Generic handler for any add-on mode change
  const handleAddonModeChange = (addonId: string, mode: string) => {
    const newModes = { ...addonModes };
    newModes[addonId] = mode;
    setAddonModes(newModes);

    // Handle special case for diversion add-ons
    if (addonId.startsWith('divert-')) {
      // Clear all other diversion modes
      Object.keys(newModes).forEach(key => {
        if (key.startsWith('divert-') && key !== addonId) {
          newModes[key] = 'none';
        }
      });
      setAddonModes(newModes);

      // Update quote data for diversion
      let divertMode: 'none' | 'takeaway' | '25' | '50' | '100' = 'none';
      if (addonId === 'divert-takeaway' && mode === 'selected') divertMode = 'takeaway';
      else if (addonId === 'divert-25' && mode === 'selected') divertMode = '25';
      else if (addonId === 'divert-50' && mode === 'selected') divertMode = '50';
      else if (addonId === 'divert-100' && mode === 'selected') divertMode = '100';

      updateQuoteData({
        addOns: {
          ...quoteData?.addOns,
          divertMode,
        },
      });
    } else {
      // Regular add-on
      // Map dashed ids to camelCase fields used in QuoteData
      const writeId = addonId === 'spray-deck' ? 'sprayDeck' : addonId;
      const writeModeKey = addonId === 'spray-deck' ? 'sprayDeckMode' : `${addonId}Mode`;

      updateQuoteData({
        addOns: {
          ...quoteData?.addOns,
          [writeId]: mode !== 'none',
          [writeModeKey]: mode === 'none' ? undefined : mode,
        },
      });
    }
  };

  // Helper function to get add-on options dynamically
  const getAddonOptions = (addon: AddOnConfig, currentMode: string, frequency: string = 'weekly') => {
    const options: Array<{
      id: string;
      title: string;
      description: string;
      price: string;
      selected: boolean;
    }> = [];

    // For diversion add-ons, they're mutually exclusive and work differently
    if (addon.id.startsWith('divert-')) {
      options.push({
        id: 'selected',
        title: addon.name,
        description: addon.description,
        price: calculateAddonPrice(addon, 'each-visit', frequency),
        selected: currentMode === 'selected',
      });
      return options;
    }

    // Add "none" option for regular add-ons
    options.push({
      id: 'none',
      title: 'No ' + addon.name,
      description: 'Standard service without this add-on',
      price: 'Included',
      selected: currentMode === 'none',
    });

    // Add billing mode options for regular add-ons
    options.push({
      id: 'each-visit',
      title: addon.name + ' (Every Visit)',
      description: `${addon.description} - billed each visit`,
      price: calculateAddonPrice(addon, 'each-visit', frequency),
      selected: currentMode === 'each-visit',
    });

    options.push({
      id: 'every-other',
      title: addon.name + ' (Every Other Visit)',
      description: `${addon.description} - billed every other visit`,
      price: calculateAddonPrice(addon, 'every-other', frequency),
      selected: currentMode === 'every-other',
    });

    options.push({
      id: 'first-visit',
      title: addon.name + ' (One-Time Only)',
      description: `${addon.description} - one-time service only`,
      price: calculateAddonPrice(addon, 'first-visit', frequency),
      selected: currentMode === 'first-visit',
    });

    return options;
  };

  // Group add-ons by category for better organization
  const groupedAddOns = React.useMemo(() => {
    const groups: Record<string, AddOnConfig[]> = {
      cleaning: [],
      waste: [],
      other: [],
    };

    availableAddOns.forEach(addon => {
      if (addon.id === 'deodorize' || addon.id === 'spray-deck') {
        groups.cleaning.push(addon);
      } else if (addon.id.startsWith('divert-')) {
        groups.waste.push(addon);
      } else {
        groups.other.push(addon);
      }
    });

    return groups;
  }, [availableAddOns]);

  // Helper function to render an add-on section
  const renderAddonSection = (addon: AddOnConfig, index: number) => {
    const options = getAddonOptions(addon, addonModes[addon.id] || 'none', quoteData?.frequency || 'weekly');
    const currentMode = addonModes[addon.id] || 'none';

    // Get appropriate icon and colors based on add-on type
    let icon = <Settings className="w-5 h-5" />;
    let colorClasses = 'text-gray-600 bg-gray-100';
    let cardColorClasses = 'ring-gray-500 bg-gray-50';

    if (addon.id === 'deodorize') {
      icon = <Sparkles className="w-5 h-5 text-purple-600" />;
      colorClasses = 'text-purple-800 bg-purple-100';
      cardColorClasses = 'ring-purple-500 bg-purple-50';
    } else if (addon.id === 'spray-deck') {
      icon = <Droplets className="w-5 h-5 text-blue-600" />;
      colorClasses = 'text-blue-800 bg-gradient-to-br from-blue-100 to-blue-200';
      cardColorClasses = 'ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100';
    } else if (addon.id.startsWith('divert-')) {
      icon = <Recycle className="w-5 h-5 text-green-600" />;
      colorClasses = 'text-green-800 bg-gradient-to-br from-green-100 to-green-200';
      cardColorClasses = 'ring-green-500 bg-gradient-to-br from-green-50 to-emerald-50';
    }

    return (
      <motion.div
        key={addon.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${colorClasses}`}>
            {icon}
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${colorClasses.includes('purple') ? 'text-purple-800' : colorClasses.includes('blue') ? 'text-blue-800' : colorClasses.includes('green') ? 'text-green-800' : 'text-gray-800'}`}>
              {addon.name}
            </h3>
            <p className="text-sm text-gray-600">{addon.description}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {options.map((option) => (
            <motion.div
              key={option.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-200 ${
                  option.selected
                    ? `ring-2 ${cardColorClasses} shadow-lg`
                    : 'hover:bg-gray-50 hover:shadow-md'
                }`}
                onClick={() => handleAddonModeChange(addon.id, option.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{option.title}</h4>
                        {option.selected && (
                          <CheckCircle className={`w-4 h-4 ${colorClasses.includes('purple') ? 'text-purple-600' : colorClasses.includes('blue') ? 'text-blue-600' : colorClasses.includes('green') ? 'text-green-600' : 'text-gray-600'}`} />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                    <Badge
                      variant={option.selected ? 'default' : 'secondary'}
                      className={`ml-3 ${option.selected && colorClasses.includes('green') ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    >
                      {option.price}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-green-700" />
            Customize Your Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Loading state */}
          {!businessConfig && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
              <span className="ml-3 text-gray-600">Loading pricing options...</span>
            </div>
          )}

          {businessConfig && (
            <div>
              <Label className="text-base font-medium">Add-on Services</Label>
              <p className="text-sm text-muted mt-1">
                Enhance your service with these optional add-ons
              </p>

              <div className="space-y-4 mt-4">
                {/* Render all available cleaning add-ons */}
                {groupedAddOns.cleaning.map((addon, index) => {
                  const currentMode = addonModes[addon.id] || 'none';
                  const options = getAddonOptions(addon, currentMode, quoteData?.frequency || 'weekly');
                  
                  return (
                    <motion.div
                      key={addon.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gradient-to-br from-white to-green-700/5 border-2 border-green-700/20 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{addon.id === 'deodorize' ? '🧼' : '🏠'}</span>
                            <Label className="text-xl font-bold text-foreground">{addon.name}</Label>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {addon.description}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className={`px-3 py-1 rounded-full ${addon.id === 'deodorize' ? 'bg-green-700/10' : 'bg-emerald-100'}`}>
                            <div className={`font-bold text-lg ${addon.id === 'deodorize' ? 'text-green-700' : 'text-emerald-700'}`}>
                              +${(addon.priceCents / 100).toFixed(2)}
                            </div>
                            <div className={`text-xs ${addon.id === 'deodorize' ? 'text-green-700/70' : 'text-emerald-600'}`}>
                              per visit
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Radio buttons */}
                      <div className="grid gap-3">
                        {quoteData?.frequency === 'one-time' ? (
                          // For one-time services, just show yes/no
                          <div className="grid grid-cols-1 gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'one-time')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'one-time'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Yes, add {addon.name.toLowerCase()}</span>
                                <span className="text-green-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} one-time</span>
                              </div>
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'none')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'none'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">No {addon.name.toLowerCase()} needed</span>
                                <span className="text-muted-foreground">Free</span>
                              </div>
                            </motion.button>
                          </div>
                        ) : (
                          // For recurring services, show multiple options
                          <div className="grid grid-cols-1 gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'first-visit')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'first-visit'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">First visit only</span>
                                <span className="text-green-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} one-time</span>
                              </div>
                              <div className="text-xs text-muted mt-1">Perfect for one-time deep clean</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'each-visit')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'each-visit'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Every visit</span>
                                <span className="text-teal-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} per visit</span>
                              </div>
                              <div className="text-xs text-muted mt-1">Continuous freshness & odor control</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'every-other')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'every-other'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Every other visit</span>
                                <span className="text-teal-700 font-bold">+${(Math.round(addon.priceCents / 2) / 100).toFixed(2)} per visit</span>
                              </div>
                              <div className="text-xs text-muted mt-1">Balanced maintenance schedule</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'none')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'none'
                                  ? `border-green-700 bg-green-700/10 shadow-md`
                                  : 'border-gray-200 hover:border-green-700/50 hover:bg-green-700/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">No {addon.name.toLowerCase()} needed</span>
                                <span className="text-muted-foreground">Free</span>
                              </div>
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Waste Diversion Add-on - Special styling to match the original */}
                {groupedAddOns.waste.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-white to-green-50/50 border-2 border-green-200/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">♻️</span>
                          <Label className="text-xl font-bold text-foreground">Waste Diversion Service</Label>
                        </div>
                        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg break-words">
                          <p className="text-sm text-green-800 font-medium mb-1">
                            🌍 All "Take Away" options remove 100% of your pet waste
                          </p>
                          <p className="text-sm text-green-700">
                            The difference is how much gets diverted from landfill to compost, creating positive environmental impact.
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed break-words">
                          Track your environmental impact on your dashboard: lbs diverted, methane avoided, compost created
                        </p>
                      </div>
                      <div className="sm:text-right sm:ml-4 mt-2 sm:mt-0 flex-shrink-0">
                        {(() => {
                          const prices = groupedAddOns.waste.map(a => a.priceCents / 100);
                          const min = prices.length ? Math.min(...prices) : 0;
                          const max = prices.length ? Math.max(...prices) : 0;
                          const range = min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–${max.toFixed(2)}`;
                          return (
                            <div className="bg-green-100 px-3 py-1 rounded-full">
                              <div className="font-bold text-green-700 text-lg">+{range}</div>
                              <div className="text-xs text-green-600">per visit</div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Enhanced Waste Diversion Options */}
                    <div className="grid gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAddonModeChange('divert-none', 'selected')}
                        className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                          !groupedAddOns.waste.some(addon => addonModes[addon.id] === 'selected')
                            ? 'border-green-500 bg-green-50 shadow-md'
                            : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Leave waste in my bin</span>
                          <span className="text-muted-foreground">Free</span>
                        </div>
                        <div className="text-xs text-muted mt-1">Standard disposal service</div>
                      </motion.button>

                      <div className="border-t border-green-200 pt-3">
                        <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                          <span className="text-lg">🌱</span>
                          Take Away Options (100% Waste Removal)
                        </h4>

                        {groupedAddOns.waste.map((addon) => {
                          const isSelected = addonModes[addon.id] === 'selected';
                          return (
                            <motion.button
                              key={addon.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, isSelected ? 'none' : 'selected')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 w-full mb-3 ${
                                isSelected
                                  ? 'border-green-500 bg-green-50 shadow-md'
                                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{addon.name}</span>
                                <span className="text-green-600 font-bold">+${(addon.priceCents / 100).toFixed(2)} per visit</span>
                              </div>
                              <div className="text-xs text-muted mt-1">{addon.description}</div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <span className="text-green-600">🌱</span>
                        <span className="text-sm font-medium">Environmental Impact Tracking</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Monitor your carbon footprint reduction and compost contribution on your dashboard
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Other Add-ons (like litter) */}
                {groupedAddOns.other.map((addon, index) => {
                  const currentMode = addonModes[addon.id] || 'none';
                  const options = getAddonOptions(addon, currentMode, quoteData?.frequency || 'weekly');
                  
                  return (
                    <motion.div
                      key={addon.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (groupedAddOns.cleaning.length + index) * 0.1 }}
                      className="bg-gradient-to-br from-white to-orange-50/50 border-2 border-orange-200/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">🐱</span>
                            <Label className="text-xl font-bold text-foreground">{addon.name}</Label>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {addon.description}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="bg-orange-100 px-3 py-1 rounded-full">
                            <div className="font-bold text-orange-700 text-lg">+${(addon.priceCents / 100).toFixed(2)}</div>
                            <div className="text-xs text-orange-600">per visit</div>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Radio buttons for other add-ons */}
                      <div className="grid gap-3">
                        {quoteData?.frequency === 'one-time' ? (
                          <div className="grid grid-cols-1 gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'one-time')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'one-time'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Yes, add {addon.name.toLowerCase()}</span>
                                <span className="text-orange-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} one-time</span>
                              </div>
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'none')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'none'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">No {addon.name.toLowerCase()} needed</span>
                                <span className="text-muted-foreground">Free</span>
                              </div>
                            </motion.button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'first-visit')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'first-visit'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">First visit only</span>
                                <span className="text-orange-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} one-time</span>
                              </div>
                              <div className="text-xs text-muted mt-1">One-time service</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'each-visit')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'each-visit'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Every visit</span>
                                <span className="text-orange-700 font-bold">+${(addon.priceCents / 100).toFixed(2)} per visit</span>
                              </div>
                              <div className="text-xs text-muted mt-1">Regular maintenance</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'every-other')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'every-other'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Every other visit</span>
                                <span className="text-orange-700 font-bold">+${(Math.round(addon.priceCents / 2) / 100).toFixed(2)} per visit</span>
                              </div>
                              <div className="text-xs text-muted mt-1">Bi-weekly maintenance</div>
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddonModeChange(addon.id, 'none')}
                              className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                                currentMode === 'none'
                                  ? 'border-orange-500 bg-orange-50 shadow-md'
                                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">No {addon.name.toLowerCase()} needed</span>
                                <span className="text-muted-foreground">Free</span>
                              </div>
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Environmental Impact Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        🌱 Eco-Friendly Practices Included
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Biodegradable bags and eco-friendly deodorizing practices included with every
                        service. Premium waste diversion options available to maximize your environmental
                        impact.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="specialInstructions" className="text-base font-medium">
                    Special Instructions (Optional)
                  </Label>
                  <Textarea
                    id="specialInstructions"
                    value={quoteData.specialInstructions || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateQuoteData({ specialInstructions: e.target.value })}
                    placeholder="Any special requests, accessibility needs, or preferences for your service..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};












