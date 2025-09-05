'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Calendar, DollarSign, User, Plus } from 'lucide-react';

import type { ServiceVisit, YarduraCustomer } from '@/lib/database';

interface CustomerWithVisits extends YarduraCustomer {
  upcomingVisits: ServiceVisit[];
  lastVisit?: ServiceVisit;
}

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<CustomerWithVisits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithVisits | null>(null);
  const [eco, setEco] = useState<{ waste: number; methane: number; compost: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    count: 1,
    weight_grams: '',
    moisture_percent: '',
    c_color: '',
    c_content: '',
    c_consistency: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      // For now, we'll load from a test API endpoint
      // In production, this would fetch from your database
      const response = await fetch('/api/admin/customers');
      if (response.ok) {
        const customers = await response.json();
        setCustomers(customers);
      } else {
        // If no API yet, show empty state
        setCustomers([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
      setLoading(false);
    }
  };

  const handleServiceComplete = async (visitId: string) => {
    try {
      const response = await fetch('/api/stripe/charge-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId }),
      });

      if (response.ok) {
        // Refresh data
        loadCustomers();
        alert('Service completed and customer charged successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error completing service:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleCancelReschedule = async (
    visitId: string,
    action: 'cancel' | 'reschedule',
    newDate?: string
  ) => {
    try {
      const response = await fetch('/api/stripe/cancel-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId, action, newDate }),
      });

      if (response.ok) {
        loadCustomers();
        alert(`${action === 'cancel' ? 'Service cancelled' : 'Service rescheduled'} successfully!`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Network error. Please try again.');
    }
  };

  const loadEcoStats = async (customerId: string) => {
    const res = await fetch(`/api/admin/eco-stats?customerId=${customerId}`);
    if (res.ok) {
      const { stats } = await res.json();
      setEco({
        waste: stats.wasteDiverted_kg,
        methane: stats.methaneAvoided_kgCO2e,
        compost: stats.compostCreated_kg,
      });
    } else {
      setEco(null);
    }
  };

  useEffect(() => {
    if (selectedCustomer) loadEcoStats(selectedCustomer.id);
  }, [selectedCustomer]);

  const submitDeposit = async () => {
    if (!selectedCustomer) return;
    setAdding(true);
    const res = await fetch('/api/admin/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        count: Number(form.count) || 1,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : undefined,
        moisture_percent: form.moisture_percent ? Number(form.moisture_percent) : undefined,
        c_color: form.c_color || undefined,
        c_content: form.c_content || undefined,
        c_consistency: form.c_consistency || undefined,
      }),
    });
    setAdding(false);
    if (res.ok) {
      await loadEcoStats(selectedCustomer.id);
      alert('Deposit recorded');
    } else {
      const e = await res.json();
      alert(e.error || 'Failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Yardura Service Dashboard</h1>
          <p className="text-gray-600">Manage customers, schedule services, and process payments</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stats Cards */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Today</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {customers.reduce(
                    (acc, customer) =>
                      acc +
                      customer.upcomingVisits.filter(
                        (v) =>
                          new Date(v.scheduledDate).toDateString() === new Date().toDateString()
                      ).length,
                    0
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Charges</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {customers.reduce(
                    (acc, customer) =>
                      acc + customer.upcomingVisits.filter((v) => v.status === 'completed').length,
                    0
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  $
                  {customers
                    .reduce(
                      (acc, customer) =>
                        acc +
                        customer.upcomingVisits
                          .filter(
                            (v) =>
                              v.status === 'completed' &&
                              new Date(v.completedDate!).getMonth() === new Date().getMonth()
                          )
                          .reduce((sum, v) => sum + v.amount, 0),
                      0
                    )
                    .toFixed(0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Active Customers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{customer.name}</h3>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                        <p className="text-xs text-gray-500">
                          {customer.dogs} dog{customer.dogs > 1 ? 's' : ''} • {customer.yardSize}{' '}
                          yard • {customer.frequency}
                        </p>
                      </div>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      Next service:{' '}
                      {customer.upcomingVisits.length > 0
                        ? new Date(customer.upcomingVisits[0].scheduledDate).toLocaleDateString()
                        : 'None scheduled'}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Customer Details */}
          <div className="lg:col-span-2">
            {selectedCustomer ? (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {eco && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl p-4 border bg-[#F6F7EC]">
                        <div className="text-xs">Waste Diverted</div>
                        <div className="text-2xl font-bold">{eco.waste} kg</div>
                      </div>
                      <div className="rounded-xl p-4 border bg-[#EFF3F6]">
                        <div className="text-xs">Methane Avoided</div>
                        <div className="text-2xl font-bold">{eco.methane} kg CO2e</div>
                      </div>
                      <div className="rounded-xl p-4 border bg-[#FDF8F4]">
                        <div className="text-xs">Compost Created</div>
                        <div className="text-2xl font-bold">{eco.compost} kg</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Name</label>
                      <p>{selectedCustomer.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p>{selectedCustomer.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Service</label>
                      <p>{selectedCustomer.frequency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Service Day</label>
                      <p>{selectedCustomer.serviceDay}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Upcoming Visits</h4>
                    {selectedCustomer.upcomingVisits.map((visit) => (
                      <div key={visit.id} className="border rounded p-3 mb-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">
                            {new Date(visit.scheduledDate).toLocaleDateString()}
                          </span>
                          <Badge variant={visit.status === 'scheduled' ? 'default' : 'secondary'}>
                            {visit.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">Amount: ${visit.amount}</div>
                        <div className="flex gap-2">
                          {visit.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleServiceComplete(visit.id)}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelReschedule(visit.id, 'cancel')}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Add Pickup / Deposit</h4>
                      <button
                        className="text-sm flex items-center gap-1"
                        onClick={submitDeposit}
                        disabled={adding}
                      >
                        <Plus className="h-4 w-4" /> {adding ? 'Saving...' : 'Add'}
                      </button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                      <label className="text-sm">
                        Count
                        <input
                          className="w-full border rounded p-2"
                          type="number"
                          min={1}
                          value={form.count}
                          onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
                        />
                      </label>
                      <label className="text-sm">
                        Weight (g)
                        <input
                          className="w-full border rounded p-2"
                          type="number"
                          value={form.weight_grams}
                          onChange={(e) => setForm({ ...form, weight_grams: e.target.value })}
                        />
                      </label>
                      <label className="text-sm">
                        Moisture (%)
                        <input
                          className="w-full border rounded p-2"
                          type="number"
                          value={form.moisture_percent}
                          onChange={(e) => setForm({ ...form, moisture_percent: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3 mt-3">
                      <label className="text-sm">
                        Color
                        <input
                          className="w-full border rounded p-2"
                          value={form.c_color}
                          onChange={(e) => setForm({ ...form, c_color: e.target.value })}
                        />
                      </label>
                      <label className="text-sm">
                        Content
                        <input
                          className="w-full border rounded p-2"
                          value={form.c_content}
                          onChange={(e) => setForm({ ...form, c_content: e.target.value })}
                        />
                      </label>
                      <label className="text-sm">
                        Consistency
                        <input
                          className="w-full border rounded p-2"
                          value={form.c_consistency}
                          onChange={(e) => setForm({ ...form, c_consistency: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-96">
                  <p className="text-gray-500">Select a customer to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
