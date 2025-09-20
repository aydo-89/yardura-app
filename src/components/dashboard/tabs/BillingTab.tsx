// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React from 'react';
import {
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Download,
  Sparkles,
  Heart,
  Dog as DogIcon,
  Building,
  Home,
  Clock,
  MapPin,
} from 'lucide-react';
import type { User, Dog } from '../types';

interface BillingTabProps {
  user: User;
  dogs?: Dog[];
}

export default function BillingTab({ user, dogs = [] }: BillingTabProps) {
  // Mock data aligned with quote process
  const serviceDetails = {
    serviceType: 'residential', // 'residential' | 'commercial'
    frequency: 'weekly', // 'weekly' | 'biweekly' | 'twice-weekly' | 'monthly' | 'onetime'
    dogs: dogs.length || 1,
    yardSize: 'medium', // 'small' | 'medium' | 'large' | 'xl'
    areasToClean: ['Front Yard', 'Back Yard'], // Array of areas
    zipCode: user.zipCode || '55419',
  };

  // Calculate visits per month based on frequency (52 weeks / 12 months = 4.33 for weekly)
  const visitsPerMonth =
    serviceDetails.frequency === 'weekly'
      ? 4.33
      : serviceDetails.frequency === 'twice-weekly'
        ? 8.67
        : serviceDetails.frequency === 'biweekly'
          ? 2.17
          : 4.33;

  const pricingDetails = {
    basePrice: 24.0, // Based on 1 dog, medium yard, weekly
    frequency: serviceDetails.frequency,
    visitsPerMonth: visitsPerMonth,
    addOns: [{ name: 'Enhanced Deodorizing', price: 25.0, frequency: 'per visit' }],
    wellnessActive: true,
    wellnessPrice: 59.99, // After 90 days free
    wellnessFreeDays: 90,
    // Correct calculation: (base per visit + add-ons per visit) × visits per month
    totalMonthly: Math.round((24.0 + 25.0) * visitsPerMonth * 100) / 100,
    nextService: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
  };

  const paymentMethods = [
    {
      id: '1',
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true,
    },
  ];

  const recentInvoices = [
    {
      id: 'inv_001',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      amount: pricingDetails.totalMonthly,
      status: 'paid',
      description: `${serviceDetails.frequency.charAt(0).toUpperCase() + serviceDetails.frequency.slice(1)} Service (${pricingDetails.visitsPerMonth} visits/month)`,
      items: [
        {
          description: 'Base service',
          amount: pricingDetails.basePrice * pricingDetails.visitsPerMonth,
        },
        { description: 'Enhanced Deodorizing', amount: 25.0 * pricingDetails.visitsPerMonth },
        { description: 'Wellness Insights (Free Trial)', amount: 0.0 },
      ],
    },
    {
      id: 'inv_002',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      amount: pricingDetails.totalMonthly,
      status: 'paid',
      description: `${serviceDetails.frequency.charAt(0).toUpperCase() + serviceDetails.frequency.slice(1)} Service (${pricingDetails.visitsPerMonth} visits/month)`,
      items: [
        {
          description: 'Base service',
          amount: pricingDetails.basePrice * pricingDetails.visitsPerMonth,
        },
        { description: 'Enhanced Deodorizing', amount: 25.0 * pricingDetails.visitsPerMonth },
        { description: 'Wellness Insights (Free Trial)', amount: 0.0 },
      ],
    },
    {
      id: 'inv_003',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      amount: pricingDetails.totalMonthly,
      status: 'paid',
      description: `${serviceDetails.frequency.charAt(0).toUpperCase() + serviceDetails.frequency.slice(1)} Service (${pricingDetails.visitsPerMonth} visits/month)`,
      items: [
        {
          description: 'Base service',
          amount: pricingDetails.basePrice * pricingDetails.visitsPerMonth,
        },
        { description: 'Enhanced Deodorizing', amount: 25.0 * pricingDetails.visitsPerMonth },
        { description: 'Wellness Insights (Free Trial)', amount: 0.0 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
          <CreditCard className="size-8 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Billing & Payments</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Manage your subscription, payment methods, and billing history
        </p>
      </div>

      {/* Service Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Service Details</h3>
          <p className="text-slate-600 text-sm">Your current service configuration</p>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                {serviceDetails.serviceType === 'residential' ? (
                  <Home className="size-6 text-green-600" />
                ) : (
                  <Building className="size-6 text-green-600" />
                )}
              </div>
              <div className="text-sm text-slate-600">Service Type</div>
              <div className="font-semibold text-slate-900 capitalize">
                {serviceDetails.serviceType}
              </div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="size-6 text-blue-600" />
              </div>
              <div className="text-sm text-slate-600">Frequency</div>
              <div className="font-semibold text-slate-900 capitalize">
                {serviceDetails.frequency}
              </div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DogIcon className="size-6 text-purple-600" />
              </div>
              <div className="text-sm text-slate-600">Dogs</div>
              <div className="font-semibold text-slate-900">{serviceDetails.dogs}</div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MapPin className="size-6 text-amber-600" />
              </div>
              <div className="text-sm text-slate-600">Property Size</div>
              <div className="font-semibold text-slate-900 capitalize">
                {serviceDetails.yardSize}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-900">Service Areas</span>
              <span className="text-sm text-slate-600">
                {serviceDetails.areasToClean.length} areas
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {serviceDetails.areasToClean.map((area, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Next Service</div>
                <div className="text-sm text-slate-600">
                  {pricingDetails.nextService.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">ZIP Code</div>
                <div className="text-sm text-slate-600">{serviceDetails.zipCode}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Plan Status */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Current Plan & Pricing</h3>
              <p className="text-slate-600 text-sm">
                Your active subscription with detailed breakdown
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              Active
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Base Service Pricing */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="size-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Base Service</h4>
                  <p className="text-sm text-slate-600">
                    {serviceDetails.frequency.charAt(0).toUpperCase() +
                      serviceDetails.frequency.slice(1)}{' '}
                    service ({pricingDetails.visitsPerMonth} visits/month)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">
                  ${(pricingDetails.basePrice * pricingDetails.visitsPerMonth).toFixed(2)}
                </div>
                <div className="text-sm text-slate-600">per month</div>
              </div>
            </div>

            {/* Add-ons */}
            {pricingDetails.addOns.map((addon, index) => (
              <div key={index} className="flex items-center justify-between mb-3 ml-13">
                <div>
                  <div className="font-medium text-slate-900 text-sm">{addon.name}</div>
                  <div className="text-sm text-slate-600">
                    per visit × {pricingDetails.visitsPerMonth} visits/month
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-900">
                  +${(addon.price * pricingDetails.visitsPerMonth).toFixed(2)}
                </div>
              </div>
            ))}

            {/* Wellness Insights */}
            <div className="flex items-center justify-between mb-3 ml-13">
              <div className="flex items-center gap-2">
                <Heart className="size-4 text-red-500" />
                <div>
                  <div className="font-medium text-slate-900 text-sm">Wellness Insights</div>
                  <div className="text-sm text-slate-600">
                    {pricingDetails.wellnessFreeDays} days free, then $
                    {pricingDetails.wellnessPrice.toFixed(2)}/month
                  </div>
                </div>
              </div>
              <div className="text-sm font-medium text-green-600">FREE</div>
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Total Monthly</div>
                <div className="text-sm text-slate-600">
                  Next billing:{' '}
                  {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">
                  ${pricingDetails.totalMonthly.toFixed(2)}
                </div>
                <div className="text-sm text-slate-600">per month</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
            <button className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium">
              Manage Plan
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Add Wellness
            </button>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Payment Methods</h3>
              <p className="text-slate-600 text-sm">Manage your saved payment options</p>
            </div>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Add Payment Method
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CreditCard className="size-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">
                      {method.brand} ****{method.last4}
                      {method.isDefault && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      Expires {method.expiryMonth}/{method.expiryYear}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-slate-600 hover:text-slate-800 text-sm">
                    Edit
                  </button>
                  {!method.isDefault && (
                    <button className="px-3 py-1 text-red-600 hover:text-red-800 text-sm">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Billing History</h3>
              <p className="text-slate-600 text-sm">View and download your invoices</p>
            </div>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Download All
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {recentInvoices.map((invoice) => (
            <div key={invoice.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      invoice.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}
                  >
                    {invoice.status === 'paid' ? (
                      <CheckCircle className="size-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="size-4 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{invoice.description}</div>
                    <div className="text-sm text-slate-600">
                      {invoice.date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    {/* Invoice Items */}
                    <div className="mt-2 space-y-1">
                      {invoice.items?.map((item, index) => (
                        <div key={index} className="text-xs text-slate-500 flex justify-between">
                          <span>{item.description}</span>
                          <span>${item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium text-slate-900">${invoice.amount.toFixed(2)}</div>
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {invoice.status}
                    </div>
                  </div>

                  <button className="p-2 text-slate-600 hover:text-slate-800">
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wellness Insights Status */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Heart className="size-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Wellness Insights</h3>
                <p className="text-slate-600 text-sm">Pet health monitoring subscription</p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              Free Trial Active
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {pricingDetails.wellnessFreeDays} days
              </div>
              <div className="text-sm text-slate-600">Remaining in free trial</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 mb-1">
                ${pricingDetails.wellnessPrice.toFixed(2)}
              </div>
              <div className="text-sm text-slate-600">Per month after trial</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="size-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Wellness Features Included:
                </p>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Stool consistency & color analysis</li>
                  <li>• Content signals analysis</li>
                  <li>• Health trend monitoring</li>
                  <li>• Alerts for concerning changes</li>
                  <li>• Monthly wellness reports</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium">
              View Wellness Dashboard
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Manage Wellness Settings
            </button>
          </div>
        </div>
      </div>

      {/* Billing Settings */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Billing Settings</h3>
          <p className="text-slate-600 text-sm">Configure your billing preferences</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-900">Email invoices</div>
              <div className="text-sm text-slate-600">Receive invoices via email</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-900">Auto-renewal</div>
              <div className="text-sm text-slate-600">Automatically renew subscription</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium">
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
