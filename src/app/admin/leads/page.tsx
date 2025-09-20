"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
  User,
  Building,
} from "lucide-react";

interface Lead {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  dogs: number;
  yardSize: string;
  frequency: string;
  address: string;
  city: string;
  zipCode: string;
  submittedAt: string;
  protectionScore: number;
  referralSource?: string | null;
  preferredContactMethod?: string | null;
  preferredContactMethods?: string[] | null;
  preferredStartDate?: string | null;
  howDidYouHear?: string | null;
  specialInstructions?: string | null;
}

export default function AdminLeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // All useState hooks MUST be called before any conditional logic
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (status === "loading") return; // Still loading

    const userRole = (session as any)?.userRole;
    const isAdmin =
      userRole === "ADMIN" ||
      userRole === "OWNER" ||
      userRole === "TECH" ||
      userRole === "SALES_REP";

    if (!session || !isAdmin) {
      router.push("/dashboard");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/admin/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.zipCode.includes(searchTerm);

    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getServiceTypeIcon = (serviceType: string) => {
    return serviceType === "commercial" ? Building : User;
  };

  const getServiceTypeColor = (serviceType: string) => {
    return serviceType === "commercial"
      ? "bg-purple-100 text-purple-800"
      : "bg-blue-100 text-blue-800";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and track leads from the quote system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {filteredLeads.length} leads
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-2xl font-bold text-gray-900">
                  {leads.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Residential</p>
                <p className="text-2xl font-bold text-gray-900">
                  {leads.filter((l) => l.serviceType === "residential").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Commercial</p>
                <p className="text-2xl font-bold text-gray-900">
                  {leads.filter((l) => l.serviceType === "commercial").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">
                  {
                    leads.filter((l) => {
                      const leadDate = new Date(l.submittedAt);
                      const weekAgo = new Date(
                        Date.now() - 7 * 24 * 60 * 60 * 1000,
                      );
                      return leadDate > weekAgo;
                    }).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or zip code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const ServiceIcon = getServiceTypeIcon(lead.serviceType);
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="w-3 h-3" />
                          {lead.email}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </div>
                        {(lead.preferredContactMethod ||
                          (lead.preferredContactMethods &&
                            lead.preferredContactMethods.length > 0)) && (
                          <div className="text-xs text-gray-500">
                            Preferred contact:{" "}
                            {lead.preferredContactMethod ||
                              lead.preferredContactMethods?.join(", ")}
                          </div>
                        )}
                        {lead.preferredStartDate && (
                          <div className="text-xs text-gray-500">
                            Preferred start:{" "}
                            {formatDate(lead.preferredStartDate)}
                          </div>
                        )}
                        {(lead.howDidYouHear || lead.referralSource) && (
                          <div className="text-xs text-gray-500">
                            Heard via:{" "}
                            {lead.howDidYouHear || lead.referralSource}
                          </div>
                        )}
                        {lead.specialInstructions && (
                          <div className="text-xs text-gray-500">
                            Notes: {lead.specialInstructions}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ServiceIcon className="w-4 h-4" />
                          <Badge
                            className={getServiceTypeColor(lead.serviceType)}
                          >
                            {lead.serviceType}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {lead.dogs} dog{lead.dogs !== 1 ? "s" : ""},{" "}
                          {lead.yardSize}, {lead.frequency?.replace("-", " ")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        {lead.city}, {lead.zipCode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(lead.submittedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Mail className="w-3 h-3 mr-1" />
                          Email
                        </Button>
                        <Button size="sm" variant="outline">
                          <Phone className="w-3 h-3 mr-1" />
                          Call
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No leads found matching your criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
