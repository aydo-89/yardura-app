"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Search,
  Loader2,
  X,
  MapPin,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ZIPSearchMap, {
  ZIPSearchResult,
  ServiceAreaData,
} from "@/components/maps/ZIPSearchMap";
import { Badge } from "@/components/ui/badge";

interface ZipStatus {
  [zipCode: string]: "available" | "added" | "adding" | "removing" | "error";
}

// US States data
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

interface LocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

// Helper function to properly capitalize city and county names
const properCapitalize = (text: string): string => {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Interface for persisting searched cities
interface SearchedCity {
  city: string;
  state: string;
  searchType: "city" | "county";
  searchResult: ZIPSearchResult;
}

// Load persisted searched cities from localStorage
function loadPersistedSearchedCities(businessId: string): SearchedCity[] {
  if (typeof window === "undefined") return [];

  try {
    const persisted = localStorage.getItem(`${businessId}-searched-cities`);
    return persisted ? JSON.parse(persisted) : [];
  } catch (error) {
    console.warn("Failed to load persisted searched cities:", error);
    return [];
  }
}

// Save searched cities to localStorage
const saveSearchedCities = (cities: SearchedCity[], businessId: string) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      `${businessId}-searched-cities`,
      JSON.stringify(cities),
    );
  } catch (error) {
    console.warn("Failed to save searched cities:", error);
  }
};

export default function AdminZipSearch() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // All useState hooks MUST be called before any conditional logic
  const [selectedLocation, setSelectedLocation] =
    useState<LocationOption | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ZIPSearchResult | null>(null);
  const [serviceAreaData, setServiceAreaData] =
    useState<ServiceAreaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipStatuses, setZipStatuses] = useState<ZipStatus>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedCities, setSearchedCities] = useState<SearchedCity[]>([]);

  // Compute businessId after hooks but before conditional returns
  const businessId = (session?.user as any)?.orgId || "yardura";

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

  // Load location options for autocomplete
  useEffect(() => {
    const loadLocationOptions = async () => {
      try {
        const response = await fetch("/api/geo/autocomplete?limit=50");
        if (response.ok) {
          const data = await response.json();
          setLocationOptions(data.options);
        }
      } catch (error) {
        console.warn("Failed to load location options:", error);
      }
    };

    loadLocationOptions();
  }, []);

  // Handle location search
  const handleLocationSearch = async (query: string) => {
    setLocationQuery(query);
    setShowLocationOptions(true);

    if (query.length < 2) {
      // Show top options if query is too short
      try {
        const response = await fetch("/api/geo/autocomplete?limit=20");
        if (response.ok) {
          const data = await response.json();
          setLocationOptions(data.options);
        }
      } catch (error) {
        console.warn("Failed to load top options:", error);
      }
      return;
    }

    try {
      const response = await fetch(
        `/api/geo/autocomplete?q=${encodeURIComponent(query)}&limit=20`,
      );
      if (response.ok) {
        const data = await response.json();
        setLocationOptions(data.options);
      }
    } catch (error) {
      console.warn("Failed to search locations:", error);
    }
  };

  // Handle location selection
  const handleLocationSelect = (option: LocationOption) => {
    setSelectedLocation(option);
    setLocationQuery(option.label);
    setShowLocationOptions(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-autocomplete]")) {
        setShowLocationOptions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load persisted ZIP statuses from localStorage
  function loadPersistedZipStatuses(businessId: string): ZipStatus {
    if (typeof window === "undefined") return {};

    try {
      const persisted = localStorage.getItem(`${businessId}-zip-statuses`);
      return persisted ? JSON.parse(persisted) : {};
    } catch (error) {
      console.warn("Failed to load persisted ZIP statuses:", error);
      return {};
    }
  }

  // Save ZIP statuses to localStorage
  const saveZipStatuses = (statuses: ZipStatus, businessId: string) => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        `${businessId}-zip-statuses`,
        JSON.stringify(statuses),
      );
    } catch (error) {
      console.warn("Failed to save ZIP statuses:", error);
    }
  };

  // Load persisted data and service area data on mount
  useEffect(() => {
    // Load persisted data from localStorage (client-side only)
    const persistedZipStatuses = loadPersistedZipStatuses(businessId);
    const persistedSearchedCities = loadPersistedSearchedCities(businessId);

    console.log("Loading persisted data on mount:", {
      zipStatusesCount: Object.keys(persistedZipStatuses).length,
      searchedCitiesCount: persistedSearchedCities.length,
      searchedCities: persistedSearchedCities.map(
        (c) => `${c.city}, ${c.state}`,
      ),
    });

    setZipStatuses(persistedZipStatuses);
    setSearchedCities(persistedSearchedCities);

    // Initialize ZIP statuses for all persisted cities
    if (persistedSearchedCities.length > 0) {
      const allZipStatuses = { ...persistedZipStatuses };
      persistedSearchedCities.forEach((cityData) => {
        cityData.searchResult.zips.forEach((zipCode) => {
          // Only set to 'available' if not already in statuses
          if (!allZipStatuses[zipCode]) {
            allZipStatuses[zipCode] = "available";
          }
        });
      });
      setZipStatuses(allZipStatuses);
    }

    // Load service area data
    loadServiceAreaData();

    // Set hasSearched to true so maps are visible on page load if we have persisted cities
    if (persistedSearchedCities.length > 0) {
      setHasSearched(true);
    }
  }, []);

  // Save ZIP statuses to localStorage whenever they change
  useEffect(() => {
    saveZipStatuses(zipStatuses, businessId);
  }, [zipStatuses, businessId]);

  // Reload service area data when ZIP codes are actually added or removed (not on status changes like 'adding')
  useEffect(() => {
    const addedZips = Object.values(zipStatuses).filter(
      (status) => status === "added",
    ).length;
    if (addedZips > 0) {
      // Only reload if there are actually added ZIPs
      const timeoutId = setTimeout(() => {
        loadServiceAreaData();
      }, 1000); // Small delay to avoid rapid reloads

      return () => clearTimeout(timeoutId);
    }
  }, [
    Object.values(zipStatuses).filter((status) => status === "added").length,
  ]);

  // Load service area data from API
  const loadServiceAreaData = async () => {
    try {
      const response = await fetch("/api/geo/service-areas");
      if (response.ok) {
        const data = await response.json();
        setServiceAreaData(data);

        // Sync ZIP statuses with actual service area data
        if (data.groups && data.groups.length > 0) {
          const actualAddedZips = new Set<string>();
          data.groups.forEach((group: any) => {
            group.zips.forEach((zip: string) => {
              actualAddedZips.add(zip);
            });
          });

          // Update ZIP statuses to match reality
          setZipStatuses((prevStatuses) => {
            const updatedStatuses: ZipStatus = { ...prevStatuses };

            // Mark all actually added ZIPs as 'added'
            actualAddedZips.forEach((zip) => {
              updatedStatuses[zip] = "added";
            });

            // Remove any ZIPs that were marked as added but aren't actually in service areas
            Object.keys(updatedStatuses).forEach((zip) => {
              if (
                updatedStatuses[zip] === "added" &&
                !actualAddedZips.has(zip)
              ) {
                delete updatedStatuses[zip];
              }
            });

            return updatedStatuses;
          });
        }
      }
    } catch (error) {
      console.warn("Failed to load service area data:", error);
    }
  };

  const searchZips = async () => {
    if (!selectedLocation) {
      setError("Please select a location");
      return;
    }

    setSearching(true);
    setError(null);
    setResults(null);
    setHasSearched(false);

    try {
      console.log(
        `Searching for ZIP codes in: ${selectedLocation.city}, ${selectedLocation.state}`,
      );
      const response = await fetch("/api/geo/zip-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: selectedLocation.city.trim(),
          state: selectedLocation.state.trim(),
          searchType: "city",
        }),
      });

      console.log("ZIP search response status:", response.status);

      if (response.ok) {
        const data: ZIPSearchResult = await response.json();
        setResults({
          ...data,
          zips: data.zips || [],
          zipsWithoutGeometry: data.zipsWithoutGeometry || [],
        });
        console.log(`Search successful: Found ${data.zips.length} ZIP codes`);
        setHasSearched(true);

        // Save this search to persisted cities
        const newSearchedCity: SearchedCity = {
          city: selectedLocation.city,
          state: selectedLocation.state,
          searchType: "city",
          searchResult: data,
        };

        // Add to searched cities (avoid duplicates)
        const updatedSearchedCities = [...searchedCities];
        const existingIndex = updatedSearchedCities.findIndex(
          (city) =>
            city.city === newSearchedCity.city &&
            city.state === newSearchedCity.state,
        );

        if (existingIndex >= 0) {
          updatedSearchedCities[existingIndex] = newSearchedCity;
        } else {
          updatedSearchedCities.push(newSearchedCity);
        }

        setSearchedCities(updatedSearchedCities);
        saveSearchedCities(updatedSearchedCities, businessId);

        // Update ZIP statuses based on search results
        const newStatuses = { ...zipStatuses };
        data.zips.forEach((zipCode) => {
          // Only set to 'available' if not already added or in process
          if (!newStatuses[zipCode] || newStatuses[zipCode] === "error") {
            newStatuses[zipCode] = "available";
          }
        });
        setZipStatuses(newStatuses);
      } else {
        const errorData = await response.json();
        console.error("Search failed:", errorData);
        setError(errorData.error || "Failed to search for ZIP codes");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search for ZIP codes");
    } finally {
      setSearching(false);
    }
  };

  // ZIP toggle functions
  const handleZipToggle = async (zipCode: string, action: "add" | "remove") => {
    if (action === "add") {
      await addZipToZone(zipCode);
    } else {
      await removeZipFromZone(zipCode);
    }
  };

  const handleBulkAdd = async (zipCodes: string[]) => {
    await addAllZipsToZone(zipCodes);
  };

  const handleClearAll = async () => {
    if (!serviceAreaData?.stats.totalZips) return;

    try {
      console.log("Clearing all ZIP codes using database reset...");

      const response = await fetch("/api/admin/clear-all-zips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Successfully cleared all ZIP codes:", result);

        // Reset local state
        setZipStatuses({});
        setServiceAreaData(null);

        // Reload service area data
        await loadServiceAreaData();

        alert(`Successfully cleared ${result.clearedZips} ZIP codes!`);
      } else {
        const error = await response.json();
        console.error("Failed to clear ZIP codes:", error);
        alert("Failed to clear ZIP codes. Please try again.");
      }
    } catch (error) {
      console.error("Failed to clear all ZIPs:", error);
      alert("Failed to clear ZIP codes. Please try again.");
    }
  };

  const addZipToZone = async (zipCode: string) => {
    setZipStatuses((prev) => ({ ...prev, [zipCode]: "adding" }));

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "add-manual-zips",
          zipCodes: [zipCode],
          zoneId: "zone-urban-core",
        }),
      });

      if (response.ok) {
        setZipStatuses((prev) => ({ ...prev, [zipCode]: "added" }));
        // Reload service area data to reflect the addition
        await loadServiceAreaData();
      } else {
        const error = await response.json();
        setError(
          `Failed to add ZIP ${zipCode}: ${error.error || "Unknown error"}`,
        );
        setZipStatuses((prev) => ({ ...prev, [zipCode]: "error" }));
      }
    } catch (err) {
      setError(`Failed to add ZIP ${zipCode}`);
      setZipStatuses((prev) => ({ ...prev, [zipCode]: "error" }));
    }
  };

  const removeZipFromZone = async (
    zipCode: string,
    zoneId: string = "zone-urban-core",
  ) => {
    setZipStatuses((prev) => ({ ...prev, [zipCode]: "removing" }));

    try {
      const response = await fetch(
        `/api/admin/service-areas?businessId=yardura&zoneId=${zoneId}&zipCode=${zipCode}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setZipStatuses((prev) => ({ ...prev, [zipCode]: "available" }));
        setError(null);
        // Reload service area data to reflect the removal
        await loadServiceAreaData();
      } else {
        const error = await response.json();
        setError(
          `Failed to remove ZIP ${zipCode}: ${error.error || "Unknown error"}`,
        );
        setZipStatuses((prev) => ({ ...prev, [zipCode]: "error" }));
      }
    } catch (err) {
      setError(`Failed to remove ZIP ${zipCode}`);
      setZipStatuses((prev) => ({ ...prev, [zipCode]: "error" }));
    }
  };

  const addAllZipsToZone = async (zipCodes: string[]) => {
    const newStatuses: ZipStatus = { ...zipStatuses };
    zipCodes.forEach((zip) => {
      newStatuses[zip] = "adding";
    });
    setZipStatuses(newStatuses);

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "add-manual-zips",
          zipCodes,
          zoneId: "zone-urban-core",
        }),
      });

      if (response.ok) {
        const successStatuses: ZipStatus = { ...zipStatuses };
        zipCodes.forEach((zip) => {
          successStatuses[zip] = "added";
        });
        setZipStatuses(successStatuses);
      } else {
        const errorStatuses: ZipStatus = { ...zipStatuses };
        zipCodes.forEach((zip) => {
          errorStatuses[zip] = "error";
        });
        setZipStatuses(errorStatuses);
      }
    } catch (err) {
      const errorStatuses: ZipStatus = { ...zipStatuses };
      zipCodes.forEach((zip) => {
        errorStatuses[zip] = "error";
      });
      setZipStatuses(errorStatuses);
    }
  };

  // Clear failed ZIP codes from localStorage
  const clearFailedZips = () => {
    const clearedStatuses: ZipStatus = {};
    // Only keep successfully added ZIP codes, remove errors
    Object.entries(zipStatuses).forEach(([zip, status]) => {
      if (status === "added") {
        clearedStatuses[zip] = status;
      }
    });
    setZipStatuses(clearedStatuses);
    saveZipStatuses(clearedStatuses, businessId);
  };

  // Handle suburban city search - auto-search for city boundaries when suburban ZIPs are added
  const handleSuburbanCitySearch = async (cityName: string, state: string) => {
    try {
      console.log(`Auto-searching for suburban city: ${cityName}, ${state}`);

      const response = await fetch("/api/geo/zip-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cityName,
          state: state,
          searchType: "city",
        }),
      });

      if (response.ok) {
        const data: ZIPSearchResult = await response.json();
        console.log(
          `✅ Successfully found ${data.zips.length} ZIPs for suburban city ${cityName}`,
        );

        // Add this city to searched cities so its boundaries appear on the map
        const newSearchedCity: SearchedCity = {
          city: cityName,
          state: state,
          searchType: "city",
          searchResult: data,
        };

        const updatedSearchedCities = [...searchedCities, newSearchedCity];
        setSearchedCities(updatedSearchedCities);
        saveSearchedCities(updatedSearchedCities, businessId);

        // Initialize ZIP statuses for the new city
        const newStatuses = { ...zipStatuses };
        data.zips.forEach((zipCode) => {
          if (!newStatuses[zipCode] || newStatuses[zipCode] === "error") {
            newStatuses[zipCode] = "available";
          }
        });
        setZipStatuses(newStatuses);
      } else {
        const errorText = await response.text();
        console.warn(
          `⚠️ Failed to search suburban city ${cityName}: ${response.status} - ${errorText}`,
        );

        // Don't throw error - just log it and continue
        // The ZIP can still be added manually even without city boundaries
      }
    } catch (error) {
      console.error(`Error searching suburban city ${cityName}:`, error);
    }
  };

  return (
    <div className="container mx-auto p-6 pt-20 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          ZIP Code Search & Management
        </h1>
        <p className="text-muted-foreground">
          Search for cities to find ZIP codes and add them to your service
          areas.
        </p>
      </div>

      {/* Compact Search Bar */}
      <div className="mb-6">
        {error && (
          <Alert className="border-red-200 bg-red-50 mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1 relative" data-autocomplete>
                <Label htmlFor="location" className="text-sm font-medium">
                  Search City
                </Label>
                <Input
                  id="location"
                  value={locationQuery}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  onFocus={() => setShowLocationOptions(true)}
                  placeholder="Type to search (e.g., Dallas, TX)..."
                  className="w-full mt-1"
                />
                {showLocationOptions && locationOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {locationOptions.map((option) => (
                      <button
                        key={option.id}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between border-b border-gray-100 last:border-b-0 transition-colors"
                        onClick={() => handleLocationSelect(option)}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {properCapitalize(option.city)}, {option.state}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Badge variant="secondary">
                              Search to see ZIPs
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={searchZips}
                disabled={searching || !selectedLocation}
                className="px-8 py-2 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search ZIPs
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Full Width Map */}
      <div className="space-y-6">
        {/* Full Width Map */}
        <ZIPSearchMap
          searchResult={results}
          serviceAreaData={serviceAreaData}
          zipStatuses={zipStatuses}
          searchedCities={searchedCities}
          onZipToggle={handleZipToggle}
          onBulkAdd={handleBulkAdd}
          onClearAll={handleClearAll}
          onClearSearchedCities={() => {
            setSearchedCities([]);
            saveSearchedCities([], businessId);
          }}
          onSuburbanCitySearch={handleSuburbanCitySearch}
          loading={searching}
          showMaps={hasSearched}
        />

        {/* Service Areas Below Map */}
        <div>
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  Service Areas
                </CardTitle>
                <div className="flex gap-2">
                  {/* Clear failed ZIP codes button */}
                  {Object.values(zipStatuses).some(
                    (status) => status === "error",
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFailedZips}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                    >
                      Clear Failed
                    </Button>
                  )}
                  {serviceAreaData?.stats.totalZips &&
                    serviceAreaData.stats.totalZips > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove all ${serviceAreaData.stats.totalZips} ZIP codes?`,
                            )
                          ) {
                            handleClearAll();
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        Clear All
                      </Button>
                    )}
                </div>
              </div>
              {serviceAreaData?.stats.totalZips &&
                serviceAreaData.stats.totalZips > 0 && (
                  <p className="text-sm text-gray-600">
                    {serviceAreaData.stats.totalZips} ZIP codes across{" "}
                    {serviceAreaData.groups.length} locations
                  </p>
                )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {serviceAreaData?.groups &&
                serviceAreaData.groups.length > 0 ? (
                  serviceAreaData.groups.map((group) => (
                    <div
                      key={`${group.city}-${group.state}`}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {properCapitalize(group.city)}, {group.state}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {group.zips.length} ZIP codes
                          </p>

                          {/* Per-city progress bar */}
                          {(() => {
                            // Find the searched city data for this group
                            const cityData = searchedCities.find(
                              (city) =>
                                city.city.toLowerCase() ===
                                  group.city.toLowerCase() &&
                                city.state === group.state,
                            );

                            if (cityData) {
                              const totalZips =
                                cityData.searchResult.zips.length;
                              const addedZips =
                                cityData.searchResult.zips.filter(
                                  (zip) => zipStatuses[zip] === "added",
                                ).length;
                              const addingZips =
                                cityData.searchResult.zips.filter(
                                  (zip) => zipStatuses[zip] === "adding",
                                ).length;
                              const selectedZips = addedZips + addingZips;
                              const progressPercent =
                                totalZips > 0
                                  ? (selectedZips / totalZips) * 100
                                  : 0;

                              return (
                                <div className="space-y-1 mt-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>
                                      {selectedZips} of {totalZips} ZIPs
                                      selected
                                    </span>
                                    <span>{progressPercent.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                      style={{ width: `${progressPercent}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const cityName = properCapitalize(group.city);
                            if (
                              window.confirm(
                                `Remove all ${group.zips.length} ZIP codes from ${cityName}, ${group.state}?`,
                              )
                            ) {
                              // Remove all ZIP codes from this city
                              group.zips.forEach((zip) =>
                                handleZipToggle(zip, "remove"),
                              );

                              // Also remove the city boundary layers from the map
                              const mapInstance = (window as any)
                                .maplibre_search;
                              if (mapInstance) {
                                const searchId = `${group.city}-${group.state}`
                                  .toLowerCase()
                                  .replace(/\s+/g, "-");
                                try {
                                  mapInstance.removeLayer(
                                    `place-boundary-${searchId}`,
                                  );
                                  mapInstance.removeLayer(
                                    `zcta-polygons-${searchId}`,
                                  );
                                  console.log(
                                    `Removed layers for ${cityName}, ${group.state}`,
                                  );
                                } catch (e) {
                                  console.warn(
                                    `Failed to remove layers for ${cityName}, ${group.state}:`,
                                    e,
                                  );
                                }
                              }
                            }
                          }}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {group.zips.map((zipCode) => (
                          <div
                            key={zipCode}
                            className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <span className="font-mono text-sm font-medium text-gray-800">
                              {zipCode}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleZipToggle(zipCode, "remove")}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Service Areas
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Search for cities or counties above to add ZIP codes to
                      your service areas.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
