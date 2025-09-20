"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MapLibreMap from "./MapLibreMap";
import * as turf from "@turf/turf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, CheckCircle, X, Plus, Minus } from "lucide-react";
import maplibregl from "maplibre-gl";

export interface ZIPSearchResult {
  searchCriteria: {
    city: string;
    state: string;
  };
  zips: string[];
  count: number;
  message: string;
  map?: {
    place: GeoJSON.Feature;
    includedZctas: GeoJSON.FeatureCollection;
  };
  coverageStats: {
    placeAreaSqm: number;
    clipsAreaSqm: number;
    ratio: number;
    coveragePercent: number;
  };
  zipsWithoutGeometry?: string[];
  zipsByCity?: { [cityName: string]: string[] };
  suburbanCities?: { [cityName: string]: string[] };
}

export interface ServiceAreaData {
  businessId: string;
  groups: Array<{
    city: string;
    state: string;
    zips: string[];
  }>;
  combined: GeoJSON.FeatureCollection;
  stats: {
    totalZips: number;
    totalGroups: number;
    totalFeatures: number;
  };
}

interface SearchedCity {
  city: string;
  state: string;
  searchType: "city" | "county";
  searchResult: ZIPSearchResult;
}

interface ZIPSearchMapProps {
  searchResult: ZIPSearchResult | null;
  serviceAreaData: ServiceAreaData | null;
  zipStatuses: {
    [zip: string]: "available" | "added" | "adding" | "removing" | "error";
  };
  searchedCities: SearchedCity[];
  onZipToggle: (zip: string, action: "add" | "remove") => void;
  onBulkAdd: (zips: string[]) => void;
  onClearAll: () => void;
  onClearSearchedCities: () => void;
  onSuburbanCitySearch?: (cityName: string, state: string) => void;
  loading?: boolean;
  showMaps?: boolean;
}

const ZIPSearchMap = ({
  searchResult,
  serviceAreaData,
  zipStatuses,
  searchedCities,
  onZipToggle,
  onBulkAdd,
  onClearAll,
  onClearSearchedCities,
  onSuburbanCitySearch,
  loading = false,
  showMaps = true,
}: ZIPSearchMapProps) => {
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [addedCities, setAddedCities] = useState<Set<string>>(new Set());
  const [mapReady, setMapReady] = useState(false);

  // Layer registry to track map layers and avoid private API access
  const layerRegistry = useRef<
    Map<
      string,
      {
        added: boolean;
        eventsBound: boolean;
        featureCollection: GeoJSON.FeatureCollection | null;
        visible: boolean;
      }
    >
  >(new Map());

  // Function to toggle city layer visibility
  const toggleCityVisibility = useCallback(
    (cityKey: string, visible: boolean) => {
      const mapInstance = (window as any).maplibre_search;
      if (!mapInstance?.map) return;

      const placeLayerId = `place-boundary-${cityKey}`;
      const zctaLayerId = `zcta-polygons-${cityKey}`;

      [placeLayerId, zctaLayerId].forEach((layerId) => {
        const layerInfo = layerRegistry.current.get(layerId);
        if (layerInfo?.added) {
          try {
            // Use setLayoutProperty to toggle visibility
            mapInstance.map.setLayoutProperty(
              layerId,
              "visibility",
              visible ? "visible" : "none",
            );
            mapInstance.map.setLayoutProperty(
              `${layerId}-stroke`,
              "visibility",
              visible ? "visible" : "none",
            );

            // Update registry
            layerRegistry.current.set(layerId, {
              ...layerInfo,
              visible,
            });
          } catch (error) {
            console.warn(
              `Failed to toggle visibility for layer ${layerId}:`,
              error,
            );
          }
        }
      });
    },
    [],
  );

  // Update ZIP colors when statuses change
  const updateZipColors = useCallback(() => {
    if (!searchResult?.map?.includedZctas) return;

    const mapInstance = (window as any).maplibre_search;
    if (!mapInstance || !mapInstance.map || !mapInstance.map.loaded()) return;

    console.log("Updating ZIP colors based on status changes");

    try {
      // Update all registered ZCTA layers using the layer registry
      layerRegistry.current.forEach((layerInfo: any, layerId: string) => {
        if (
          layerInfo.added &&
          layerInfo.featureCollection &&
          layerId.startsWith("zcta-polygons-")
        ) {
          try {
            // Update features with current ZIP statuses
            const updatedFeatures = layerInfo.featureCollection.features.map(
              (feature: any) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  status: zipStatuses[feature.properties?.zip] || "available",
                },
              }),
            );

            const updatedCollection: GeoJSON.FeatureCollection = {
              type: "FeatureCollection",
              features: updatedFeatures,
            };

            // Use the map instance's addGeoJsonLayer method to update
            // This avoids accessing private source internals
            mapInstance.addGeoJsonLayer({
              id: layerId,
              data: updatedCollection,
              fillColor: [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                [
                  "match",
                  ["get", "status"],
                  "added",
                  "#dc2626",
                  "adding",
                  "#84cc16",
                  "removing",
                  "#f59e0b",
                  "error",
                  "#ef4444",
                  "#22c55e",
                ],
                [
                  "match",
                  ["get", "status"],
                  "added",
                  "#22c55e",
                  "adding",
                  "#84cc16",
                  "removing",
                  "#f59e0b",
                  "error",
                  "#ef4444",
                  "#e5e7eb",
                ],
              ],
              fillOpacity: [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.8,
                [
                  "match",
                  ["get", "status"],
                  "added",
                  0.6,
                  "adding",
                  0.4,
                  "removing",
                  0.4,
                  "error",
                  0.4,
                  0.3,
                ],
              ],
              strokeColor: [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                [
                  "match",
                  ["get", "status"],
                  "added",
                  "#b91c1c",
                  "adding",
                  "#65a30d",
                  "removing",
                  "#d97706",
                  "error",
                  "#dc2626",
                  "#16a34a",
                ],
                [
                  "match",
                  ["get", "status"],
                  "added",
                  "#16a34a",
                  "adding",
                  "#65a30d",
                  "removing",
                  "#d97706",
                  "error",
                  "#dc2626",
                  "#9ca3af",
                ],
              ],
              strokeWidth: [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                3,
                2,
              ],
              strokeOpacity: 0.8,
            });

            // Update the registry with new feature collection
            layerRegistry.current.set(layerId, {
              ...layerInfo,
              featureCollection: updatedCollection,
            });
          } catch (layerError) {
            console.warn(`Failed to update layer ${layerId}:`, layerError);
          }
        }
      });

      console.log("Updated ZIP colors successfully");
    } catch (error) {
      console.error("Failed to update ZIP colors:", error);
    }
  }, [searchResult, zipStatuses]);

  // Handle ZIP polygon clicks on the search map (works for all cities)
  const handleSearchMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const mapInstance = (window as any).maplibre_search;
      if (!mapInstance?.map) return;

      // Query all ZCTA layers (for cumulative searches)
      const layers = mapInstance.map.getStyle().layers || [];
      const zctaLayers = layers
        .filter(
          (layer: any) => layer.id && layer.id.startsWith("zcta-polygons-"),
        )
        .map((layer: any) => layer.id);

      const features = mapInstance.map.queryRenderedFeatures(e.point, {
        layers: zctaLayers,
      });

      if (features && features.length > 0) {
        const zip = features[0].properties?.zip;
        if (zip) {
          setSelectedZip(zip);
          const status = zipStatuses[zip] || "available";

          console.log("Clicked on ZIP:", zip);
          console.log("Current status from state:", status);

          if (status === "available") {
            console.log(`Adding ZIP ${zip}`);
            onZipToggle(zip, "add");
            // Force color update after a short delay
            setTimeout(() => {
              console.log(`Updating colors after adding ZIP ${zip}`);
              updateZipColors();
            }, 500);
          } else if (status === "added") {
            console.log(`Removing ZIP ${zip}`);
            onZipToggle(zip, "remove");
            // Force color update after a short delay
            setTimeout(() => {
              console.log(`Updating colors after removing ZIP ${zip}`);
              updateZipColors();
            }, 500);
          } else {
            console.log(
              `ZIP ${zip} not clickable - status: ${status}, available statuses:`,
              Object.keys(zipStatuses),
            );
          }
        }
      }
    },
    [zipStatuses, onZipToggle, updateZipColors],
  );

  // Handle hover effects for ZIP polygons
  const setupHoverEffects = useCallback(() => {
    const mapInstance = (window as any).maplibre_search;
    if (
      !mapInstance?.map ||
      !mapInstance.map.loaded() ||
      !mapInstance.map.isStyleLoaded()
    )
      return;

    const map = mapInstance.map;
    let hoveredZipId: string | number | null = null;
    let hoveredSource: string | null = null;

    // Mouse enter handler
    const onMouseEnter = (e: any) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const zip = feature.properties?.zip;
        const status = feature.properties?.status;

        // Clear previous hover state
        if (hoveredZipId !== null && hoveredSource !== null) {
          try {
            map.setFeatureState(
              { source: hoveredSource, id: hoveredZipId },
              { hover: false },
            );
          } catch (e) {
            // Ignore if feature doesn't exist
          }
        }

        hoveredZipId = feature.id;
        hoveredSource = feature.layer.source;

        try {
          map.setFeatureState(
            { source: hoveredSource, id: hoveredZipId },
            { hover: true },
          );
        } catch (e) {
          console.warn(`Failed to set hover state for ZIP ${zip}:`, e);
        }

        // Change cursor based on status
        if (status === "available" || status === "added") {
          map.getCanvas().style.cursor = "pointer";
        } else {
          map.getCanvas().style.cursor = "not-allowed";
        }
      }
    };

    // Mouse leave handler
    const onMouseLeave = () => {
      if (hoveredZipId !== null && hoveredSource !== null) {
        try {
          map.setFeatureState(
            { source: hoveredSource, id: hoveredZipId },
            { hover: false },
          );
        } catch (e) {
          // Ignore if feature doesn't exist
        }
      }
      hoveredZipId = null;
      hoveredSource = null;
      map.getCanvas().style.cursor = "";
    };

    // Get all ZCTA layer IDs
    const layers = map.getStyle().layers || [];
    const zctaLayers = layers
      .filter((layer: any) => layer.id && layer.id.startsWith("zcta-polygons-"))
      .map((layer: any) => layer.id);

    console.log(
      `Setting up hover effects for ${zctaLayers.length} ZCTA layers:`,
      zctaLayers,
    );

    // Remove existing event handlers first to avoid duplicates
    zctaLayers.forEach((layerId: string) => {
      try {
        map.off("mouseenter", layerId, onMouseEnter);
        map.off("mouseleave", layerId, onMouseLeave);
      } catch (e) {
        // Layer might not exist
      }
    });

    // Add hover effects to all ZCTA layers
    zctaLayers.forEach((layerId: string) => {
      try {
        map.on("mouseenter", layerId, onMouseEnter);
        map.on("mouseleave", layerId, onMouseLeave);
        console.log(`Added hover effects to layer: ${layerId}`);
      } catch (e) {
        console.warn(`Failed to add hover effects to layer ${layerId}:`, e);
      }
    });

    // Return cleanup function
    return () => {
      zctaLayers.forEach((layerId: string) => {
        try {
          map.off("mouseenter", layerId, onMouseEnter);
          map.off("mouseleave", layerId, onMouseLeave);
        } catch (e) {
          // Layer might not exist anymore
        }
      });
    };
  }, []);

  // Function to initialize layers (can be called with retry)
  const initializeLayers = useCallback(() => {
    if (!searchResult?.map || !searchResult.map.includedZctas) {
      console.log("No search result data for layer initialization");
      return;
    }

    console.log("Initializing map layers with search result:", {
      placeType: searchResult.map.place?.geometry?.type,
      zctaCount: searchResult.map.includedZctas?.features?.length,
    });

    const mapInstance = (window as any).maplibre_search;
    if (!mapInstance) {
      console.log("Map instance not ready, retrying...");
      // Retry after a short delay
      setTimeout(() => {
        initializeLayers();
      }, 100);
      return;
    }

    console.log("Map instance found, proceeding with layer addition");

    // Generate unique layer IDs for this search to make it cumulative
    const searchId =
      `${searchResult.searchCriteria.city}-${searchResult.searchCriteria.state}`
        .toLowerCase()
        .replace(/\s+/g, "-");
    const placeLayerId = `place-boundary-${searchId}`;

    try {
      console.log("Adding place boundary layer:", placeLayerId);
      mapInstance.addGeoJsonLayer({
        id: placeLayerId,
        data: searchResult.map.place,
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        strokeColor: "#2563eb",
        strokeWidth: 3,
        strokeOpacity: 1,
      });

      // Register place boundary layer in registry
      layerRegistry.current.set(placeLayerId, {
        added: true,
        eventsBound: false,
        featureCollection: null, // Not a feature collection
        visible: true,
      });

      console.log("Place boundary layer added successfully");
    } catch (error) {
      console.error("Failed to add place boundary:", error);
      // Retry after a short delay
      setTimeout(() => {
        initializeLayers();
      }, 200);
      return;
    }

    try {
      console.log("Adding ZIP polygon layers...");
      console.log(
        "ZCTA features count:",
        searchResult.map.includedZctas.features.length,
      );

      // Add ZIP polygons with status-based coloring
      const zctaFeatures = searchResult.map.includedZctas.features.map(
        (feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            status: zipStatuses[feature.properties?.zip] || "available",
          },
        }),
      );

      const zctaCollection: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: zctaFeatures,
      };

      console.log(
        "Adding ZCTA collection with",
        zctaFeatures.length,
        "features",
      );

      const zctaLayerId = `zcta-polygons-${searchId}`;

      mapInstance.addGeoJsonLayer({
        id: zctaLayerId,
        data: zctaCollection,
        fillColor: [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          [
            "match",
            ["get", "status"],
            "added",
            "#dc2626", // Red hover for added (to remove)
            "adding",
            "#84cc16", // Same for adding
            "removing",
            "#f59e0b", // Same for removing
            "error",
            "#ef4444", // Same for error
            "#22c55e", // Green hover for available (to add)
          ],
          [
            "match",
            ["get", "status"],
            "added",
            "#22c55e", // Green for added
            "adding",
            "#84cc16", // Light green for adding
            "removing",
            "#f59e0b", // Orange for removing
            "error",
            "#ef4444", // Red for error
            "#e5e7eb", // Light gray for available
          ],
        ],
        fillOpacity: [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.8, // Higher opacity on hover
          [
            "match",
            ["get", "status"],
            "added",
            0.6,
            "adding",
            0.4,
            "removing",
            0.4,
            "error",
            0.4,
            0.3, // Default for available
          ],
        ],
        strokeColor: [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          [
            "match",
            ["get", "status"],
            "added",
            "#b91c1c", // Darker red hover for added
            "adding",
            "#65a30d", // Same for adding
            "removing",
            "#d97706", // Same for removing
            "error",
            "#dc2626", // Same for error
            "#16a34a", // Darker green hover for available
          ],
          [
            "match",
            ["get", "status"],
            "added",
            "#16a34a",
            "adding",
            "#65a30d",
            "removing",
            "#d97706",
            "error",
            "#dc2626",
            "#9ca3af", // Gray for available
          ],
        ],
        strokeWidth: [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          3, // Thicker stroke on hover
          2,
        ],
        strokeOpacity: 0.8,
      });

      // Register ZCTA layer in registry
      layerRegistry.current.set(zctaLayerId, {
        added: true,
        eventsBound: false,
        featureCollection: zctaCollection,
        visible: true,
      });

      console.log("ZIP polygon layers added successfully");

      // Set up hover effects for all layers (including the new one)
      setTimeout(() => setupHoverEffects(), 200);

      // Fit to place boundary with some padding (only for new searches)
      console.log("Fitting map to place boundary...");

      // Force map to center on the place with appropriate zoom
      try {
        const centroid = turf.centroid(searchResult.map.place);
        const [lng, lat] = centroid.geometry.coordinates;
        console.log(`Centering map on: [${lng}, ${lat}]`);

        mapInstance.setCenter([lng, lat]);
        mapInstance.setZoom(11); // City-level zoom

        // Then fit to data with padding
        setTimeout(() => {
          if (searchResult.map?.place) {
            mapInstance.fitToData(searchResult.map.place);
            console.log("Map fitted to data");
          }
        }, 100);
      } catch (fitError) {
        console.error("Failed to fit map to data:", fitError);
      }
    } catch (error) {
      console.error("Failed to add ZIP polygons:", error);
      // Retry after a short delay
      setTimeout(() => {
        initializeLayers();
      }, 300);
      return;
    }
  }, [searchResult, zipStatuses]);

  // Track if layers have been initialized to prevent flickering
  const [layersInitialized, setLayersInitialized] = useState(false);

  // Update colors when ZIP statuses change (debounced to prevent flickering)
  useEffect(() => {
    if (!mapReady) return;

    const timeoutId = setTimeout(() => {
      console.log("ZIP statuses changed, updating map colors");
      updateZipColors();
    }, 100); // Small delay to debounce rapid changes

    return () => clearTimeout(timeoutId);
  }, [zipStatuses, mapReady, updateZipColors]);

  // Restore all searched cities on mount to maintain map persistence
  useEffect(() => {
    console.log("Restoration effect triggered:", {
      mapReady,
      searchedCitiesLength: searchedCities?.length,
      addedCitiesSize: addedCities.size,
    });

    if (!mapReady || !searchedCities || searchedCities.length === 0) {
      console.log("Skipping restoration - conditions not met");
      return;
    }

    const mapInstance = (window as any).maplibre_search;
    if (
      !mapInstance ||
      !mapInstance.map ||
      !mapInstance.map.loaded() ||
      !mapInstance.map.isStyleLoaded()
    ) {
      console.log("Map not ready for restoration, retrying in 500ms...");
      // Retry when map is ready
      const retryTimeout = setTimeout(() => {
        // Force re-check of map readiness
        const newMapInstance = (window as any).maplibre_search;
        if (
          newMapInstance &&
          newMapInstance.map &&
          newMapInstance.map.loaded() &&
          newMapInstance.map.isStyleLoaded()
        ) {
          setMapReady(true); // This will trigger the effect again
        }
      }, 500);
      return () => clearTimeout(retryTimeout);
    }

    console.log(
      `Map ready - restoring ${searchedCities.length} searched cities:`,
      searchedCities.map((c) => `${c.city}, ${c.state}`),
    );

    // Restore all searched cities to the map
    searchedCities.forEach((cityData) => {
      const cityKey = `${cityData.city}-${cityData.state}`;

      // Skip if already added
      if (addedCities.has(cityKey)) return;

      console.log(`Restoring city: ${cityData.city}, ${cityData.state}`);

      // Add the city layers to the map
      if (
        cityData.searchResult?.map?.place &&
        cityData.searchResult?.map?.includedZctas
      ) {
        const searchId = `${cityData.city}-${cityData.state}`
          .toLowerCase()
          .replace(/\s+/g, "-");
        const placeLayerId = `place-boundary-${searchId}`;
        const zctaLayerId = `zcta-polygons-${searchId}`;

        try {
          // Add place boundary
          mapInstance.addGeoJsonLayer({
            id: placeLayerId,
            data: cityData.searchResult.map.place,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            strokeColor: "#2563eb",
            strokeWidth: 3,
            strokeOpacity: 1,
          });

          // Add ZIP polygons with current status
          const zctaFeatures =
            cityData.searchResult.map.includedZctas.features.map((feature) => ({
              ...feature,
              properties: {
                ...feature.properties,
                status: zipStatuses[feature.properties?.zip] || "available",
                searchId,
              },
            }));

          const zctaCollection: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: zctaFeatures,
          };

          mapInstance.addGeoJsonLayer({
            id: zctaLayerId,
            data: zctaCollection,
            fillColor: [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              [
                "match",
                ["get", "status"],
                "added",
                "#dc2626", // Red hover for added (to remove)
                "adding",
                "#84cc16", // Same for adding
                "removing",
                "#f59e0b", // Same for removing
                "error",
                "#ef4444", // Same for error
                "#22c55e", // Green hover for available (to add)
              ],
              [
                "match",
                ["get", "status"],
                "added",
                "#22c55e", // Green for added
                "adding",
                "#84cc16", // Light green for adding
                "removing",
                "#f59e0b", // Orange for removing
                "error",
                "#ef4444", // Red for error
                "#e5e7eb", // Light gray for available
              ],
            ],
            fillOpacity: [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.8, // Higher opacity on hover
              [
                "match",
                ["get", "status"],
                "added",
                0.6,
                "adding",
                0.4,
                "removing",
                0.4,
                "error",
                0.4,
                0.3,
              ],
            ],
            strokeColor: [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              [
                "match",
                ["get", "status"],
                "added",
                "#b91c1c", // Darker red hover for added
                "adding",
                "#65a30d", // Same for adding
                "removing",
                "#d97706", // Same for removing
                "error",
                "#dc2626", // Same for error
                "#16a34a", // Darker green hover for available
              ],
              [
                "match",
                ["get", "status"],
                "added",
                "#16a34a",
                "adding",
                "#65a30d",
                "removing",
                "#d97706",
                "error",
                "#dc2626",
                "#9ca3af",
              ],
            ],
            strokeWidth: [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              3, // Thicker stroke on hover
              2,
            ],
            strokeOpacity: 0.8,
          });

          // Mark as added
          setAddedCities((prev) => new Set(prev).add(cityKey));

          console.log(
            `Restored layers for ${cityData.city}, ${cityData.state}`,
          );
        } catch (error) {
          console.warn(
            `Failed to restore layers for ${cityData.city}, ${cityData.state}:`,
            error,
          );
        }
      }
    });
    // After restoration, ensure colors reflect current statuses and set up hover effects
    setTimeout(() => {
      updateZipColors();
      setupHoverEffects();
    }, 300);
  }, [
    searchedCities,
    addedCities,
    zipStatuses,
    mapReady,
    updateZipColors,
    setupHoverEffects,
  ]);

  // Update search map layers when search result changes (cumulative)
  useEffect(() => {
    if (!searchResult?.map) return;

    // Check if this city has already been added to prevent duplicates
    const cityKey = `${searchResult.searchCriteria.city}-${searchResult.searchCriteria.state}`;
    if (addedCities.has(cityKey)) {
      console.log(
        `City ${cityKey} already added, skipping layer initialization`,
      );
      return;
    }

    console.log("New search result, adding layers cumulatively for:", cityKey);

    // Wait for map to be fully ready before initializing layers
    const checkAndInitialize = () => {
      const mapInstance = (window as any).maplibre_search;
      if (
        mapInstance &&
        mapInstance.map &&
        mapInstance.map.loaded() &&
        mapInstance.map.isStyleLoaded()
      ) {
        console.log("Map is fully ready, initializing layers now");
        initializeLayers();
        setLayersInitialized(true);

        // Mark this city as added
        setAddedCities((prev) => new Set(prev).add(cityKey));
      } else {
        setTimeout(checkAndInitialize, 500); // Longer delay to reduce spam
      }
    };

    checkAndInitialize();
  }, [
    searchResult?.searchCriteria?.city,
    searchResult?.searchCriteria?.state,
    addedCities,
  ]); // Only when search criteria changes

  // Don't reset layers when search result changes - allow multiple cities
  // Only reset when explicitly clearing or when no search results
  useEffect(() => {
    if (!searchResult) {
      setLayersInitialized(false);
    }
  }, [searchResult]);

  // Track if service area layers have been initialized
  const [serviceLayersInitialized, setServiceLayersInitialized] =
    useState(false);

  // Update service area map when data changes
  useEffect(() => {
    if (!serviceAreaData?.combined) return;

    const updateServiceMap = () => {
      const mapInstance = (window as any).maplibre_service;
      if (
        !mapInstance ||
        !mapInstance.map ||
        !mapInstance.map.loaded() ||
        !mapInstance.map.isStyleLoaded()
      ) {
        setTimeout(updateServiceMap, 200);
        return;
      }

      console.log(
        "Updating service area map with",
        serviceAreaData.combined.features.length,
        "features",
      );

      // Clear existing layers
      try {
        mapInstance.removeLayer("service-areas");
      } catch (e) {
        // Layer doesn't exist yet
      }

      if (serviceAreaData.combined.features.length === 0) {
        console.log("No service areas to display");
        return;
      }

      // Add combined service areas with better styling
      mapInstance.addGeoJsonLayer({
        id: "service-areas",
        data: serviceAreaData.combined,
        fillColor: "#22c55e",
        fillOpacity: 0.5,
        strokeColor: "#16a34a",
        strokeWidth: 2,
        strokeOpacity: 1.0,
      });

      // Fit to all service areas
      try {
        mapInstance.fitToData(serviceAreaData.combined);
        console.log("Service area map fitted to data");
        setServiceLayersInitialized(true);
      } catch (fitError) {
        console.error("Failed to fit service area map:", fitError);
      }
    };

    if (!serviceLayersInitialized) {
      updateServiceMap();
    }
  }, [serviceAreaData, serviceLayersInitialized]);

  // Reset service layers when data changes significantly
  useEffect(() => {
    setServiceLayersInitialized(false);
  }, [serviceAreaData?.stats?.totalZips]);

  const handleBulkAdd = () => {
    if (!searchResult?.zips) return;
    const availableZips = searchResult.zips.filter(
      (zip) => zipStatuses[zip] === "available",
    );
    if (availableZips.length > 0) {
      onBulkAdd(availableZips);
    }
  };

  const getZipBadgeVariant = (zip: string) => {
    const status = zipStatuses[zip];
    if (status === "added") return "default";
    if (status === "error") return "destructive";
    if (status === "removing") return "outline";
    return "secondary";
  };

  const getZipDisplayText = (zip: string) => {
    const status = zipStatuses[zip];
    if (status === "adding") return `${zip} (Adding...)`;
    if (status === "added") return `${zip} ✓`;
    if (status === "removing") return `${zip} (Removing...)`;
    if (status === "error") return `${zip} ✗`;
    return zip;
  };

  // Handle suburban ZIP toggle with auto-search for city boundaries
  const handleSuburbanZipToggle = async (
    zip: string,
    cityName: string,
    action: "add" | "remove",
  ) => {
    if (action === "add") {
      // First auto-search for the suburban city's boundaries if not already searched
      if (
        onSuburbanCitySearch &&
        !searchedCities.some(
          (city) =>
            city.city.toLowerCase() === cityName.toLowerCase() &&
            city.state === searchResult?.searchCriteria.state,
        )
      ) {
        console.log(
          `🔍 Auto-searching for suburban city FIRST: ${cityName}, ${searchResult?.searchCriteria.state}`,
        );

        try {
          await onSuburbanCitySearch(
            cityName,
            searchResult?.searchCriteria.state || "",
          );
          console.log(`✅ Suburban city search completed for ${cityName}`);

          // Longer delay to ensure city boundaries are fully loaded and rendered
          setTimeout(() => {
            console.log(
              `➕ Now adding ZIP ${zip} to ${cityName} after city boundaries loaded`,
            );
            onZipToggle(zip, "add");
          }, 2000);
        } catch (error) {
          console.error(
            `❌ Failed to search suburban city ${cityName}:`,
            error,
          );
          // Fallback: just add the ZIP without city boundaries
          onZipToggle(zip, "add");
        }
      } else {
        // City already searched, just add the ZIP
        console.log(
          `City ${cityName} already searched, adding ZIP ${zip} directly`,
        );
        onZipToggle(zip, "add");
      }
    } else {
      onZipToggle(zip, "remove");
    }
  };

  // Handle reverse ZIP lookup to find actual cities for ZIPs without map data
  const handleReverseZipLookup = async (zips: string[]) => {
    console.log(
      `Starting reverse lookup for ${zips.length} ZIPs to find their actual cities`,
    );

    for (const zip of zips.slice(0, 5)) {
      // Limit to first 5 to avoid API spam
      try {
        const zipUrl = `https://api.zippopotam.us/us/${zip}`;
        const response = await fetch(zipUrl);

        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
            const actualCity = data.places[0]["place name"];
            const actualState = data["state abbreviation"];

            console.log(`ZIP ${zip} belongs to ${actualCity}, ${actualState}`);

            // If it's a different city than the current search, auto-search for it
            if (
              actualCity.toLowerCase() !==
                searchResult?.searchCriteria.city.toLowerCase() &&
              onSuburbanCitySearch &&
              !searchedCities.some(
                (city) =>
                  city.city.toLowerCase() === actualCity.toLowerCase() &&
                  city.state === actualState,
              )
            ) {
              console.log(
                `Auto-searching for ZIP's actual city: ${actualCity}, ${actualState}`,
              );
              await onSuburbanCitySearch(actualCity, actualState);
            }
          }
        }

        // Small delay between API calls
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`Failed reverse lookup for ZIP ${zip}:`, error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Map and Controls */}
      <div className="space-y-6">
        {/* Enhanced Search Map */}
        <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
            <CardTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <div className="text-xl font-bold text-slate-900">
                    {searchResult
                      ? `${searchResult.searchCriteria.city}, ${searchResult.searchCriteria.state}`
                      : "ZIP Code Search Map"}
                  </div>
                  {searchResult && (
                    <div className="text-sm text-slate-600 font-medium">
                      {searchResult.count} ZIP codes found •{" "}
                      {searchResult.coverageStats.coveragePercent}% coverage
                    </div>
                  )}
                </div>
                {searchResult && (
                  <Button
                    onClick={() => {
                      const cityKey =
                        `${searchResult.searchCriteria.city}-${searchResult.searchCriteria.state}`
                          .toLowerCase()
                          .replace(/\s+/g, "-");
                      const isVisible =
                        layerRegistry.current.get(`place-boundary-${cityKey}`)
                          ?.visible ?? true;
                      toggleCityVisibility(cityKey, !isVisible);
                    }}
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-2 hover:border-brand-300 hover:bg-brand-50 transition-all duration-200"
                  >
                    {(layerRegistry.current.get(
                      `place-boundary-${searchResult.searchCriteria.city.toLowerCase().replace(/\s+/g, "-")}-${searchResult.searchCriteria.state.toLowerCase()}`,
                    )?.visible ?? true)
                      ? "Hide Layer"
                      : "Show Layer"}
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Enhanced Map Legend */}
            <div className="p-6 bg-slate-50/50 border-b border-slate-200/60">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-3 border-blue-600 bg-blue-100/50 rounded-lg"></div>
                  <span className="font-medium text-slate-700">
                    City Boundary
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-slate-200 border-2 border-slate-400"></div>
                  <span className="font-medium text-slate-700">
                    Available ZIPs
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-green-500 border-2 border-green-600"></div>
                  <span className="font-medium text-slate-700">Added ZIPs</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-orange-400 border-2 border-orange-500"></div>
                  <span className="font-medium text-slate-700">Processing</span>
                </div>
              </div>
            </div>

            <div className="relative bg-slate-100 rounded-2xl overflow-hidden">
              <MapLibreMap
                id="search"
                center={
                  searchResult?.map?.place
                    ? (() => {
                        try {
                          const centroid = turf.centroid(
                            searchResult.map.place,
                          );
                          return [
                            centroid.geometry.coordinates[0],
                            centroid.geometry.coordinates[1],
                          ];
                        } catch (e) {
                          return [-98.5795, 39.8283]; // US center fallback
                        }
                      })()
                    : [-98.5795, 39.8283]
                }
                zoom={searchResult?.map?.place ? 11 : 4}
                onClick={handleSearchMapClick}
                onLoad={() => setMapReady(true)}
                className="w-full h-[500px] rounded-2xl"
              />
              {loading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                  <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Loading ZIP data...
                    </span>
                  </div>
                </div>
              )}

              {/* Map controls overlay */}
              {searchResult && (
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      const cityKey =
                        `${searchResult.searchCriteria.city}-${searchResult.searchCriteria.state}`
                          .toLowerCase()
                          .replace(/\s+/g, "-");
                      const isVisible =
                        layerRegistry.current.get(`place-boundary-${cityKey}`)
                          ?.visible ?? true;
                      toggleCityVisibility(cityKey, !isVisible);
                    }}
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 backdrop-blur-sm border border-white/60 shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 rounded-xl"
                  >
                    {(layerRegistry.current.get(
                      `place-boundary-${searchResult.searchCriteria.city.toLowerCase().replace(/\s+/g, "-")}-${searchResult.searchCriteria.state.toLowerCase()}`,
                    )?.visible ?? true)
                      ? "👁️ Hide"
                      : "👁️‍🗨️ Show"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced ZIP List */}
        {searchResult && searchResult.zips.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl">
                    <span className="text-lg font-bold text-green-600">
                      {searchResult.count}
                    </span>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">
                      ZIP Codes for {searchResult.searchCriteria.city},{" "}
                      {searchResult.searchCriteria.state}
                    </div>
                    <div className="text-sm text-slate-600 font-medium">
                      {
                        searchResult.zips.filter(
                          (zip) => zipStatuses[zip] === "added",
                        ).length
                      }{" "}
                      added •{" "}
                      {
                        searchResult.zips.filter(
                          (zip) => zipStatuses[zip] === "available",
                        ).length
                      }{" "}
                      available
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleBulkAdd}
                  disabled={
                    loading ||
                    !searchResult.zips.some(
                      (zip) => zipStatuses[zip] === "available",
                    )
                  }
                  className="bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add All Available
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3">
                {searchResult.zips.map((zip) => (
                  <Badge
                    key={zip}
                    variant={getZipBadgeVariant(zip)}
                    className={`cursor-pointer transition-all duration-200 px-4 py-2 rounded-2xl font-semibold text-sm border-2 ${
                      zipStatuses[zip] === "available"
                        ? "hover:bg-green-100 hover:text-green-800 hover:border-green-300 hover:scale-105 bg-slate-100 text-slate-700 border-slate-300"
                        : zipStatuses[zip] === "added"
                          ? "hover:bg-red-100 hover:text-red-800 hover:border-red-300 hover:scale-105 bg-green-100 text-green-800 border-green-300"
                          : zipStatuses[zip] === "adding" ||
                              zipStatuses[zip] === "removing"
                            ? "animate-pulse bg-orange-100 text-orange-800 border-orange-300"
                            : zipStatuses[zip] === "error"
                              ? "cursor-not-allowed bg-red-100 text-red-800 border-red-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                    onClick={() => {
                      const status = zipStatuses[zip];
                      if (status === "available") {
                        onZipToggle(zip, "add");
                      } else if (status === "added") {
                        onZipToggle(zip, "remove");
                      }
                    }}
                    title={
                      zipStatuses[zip] === "available"
                        ? "Click to add this ZIP code"
                        : zipStatuses[zip] === "added"
                          ? "Click to remove this ZIP code"
                          : zipStatuses[zip] === "adding"
                            ? "Adding ZIP code..."
                            : zipStatuses[zip] === "removing"
                              ? "Removing ZIP code..."
                              : zipStatuses[zip] === "error"
                                ? "Failed to process - try again"
                                : "ZIP code"
                    }
                  >
                    {zipStatuses[zip] === "adding" ||
                    zipStatuses[zip] === "removing" ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : zipStatuses[zip] === "added" ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : zipStatuses[zip] === "available" ? (
                      <Plus className="w-3 h-3 mr-1" />
                    ) : null}
                    {getZipDisplayText(zip)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ZIPs Without Map Data */}
        {searchResult?.zipsWithoutGeometry &&
          searchResult.zipsWithoutGeometry.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <span>
                      ZIPs Without Map Data for{" "}
                      {searchResult.searchCriteria.city},{" "}
                      {searchResult.searchCriteria.state}
                    </span>
                    <Button
                      onClick={() =>
                        handleReverseZipLookup(
                          searchResult.zipsWithoutGeometry || [],
                        )
                      }
                      size="sm"
                      variant="ghost"
                      className="ml-2 text-xs"
                    >
                      🔍 Find Cities
                    </Button>
                  </div>
                  {(() => {
                    const availableZips =
                      searchResult.zipsWithoutGeometry?.filter(
                        (zip) => zipStatuses[zip] !== "added",
                      ) || [];
                    const addedZips =
                      searchResult.zipsWithoutGeometry?.filter(
                        (zip) => zipStatuses[zip] === "added",
                      ) || [];
                    const hasAvailable = availableZips.length > 0;
                    const hasAdded = addedZips.length > 0;

                    if (hasAdded && !hasAvailable) {
                      // All are added - show Remove All
                      return (
                        <Button
                          onClick={async () => {
                            console.log(
                              `Removing all ${addedZips.length} ZIPs without map data`,
                            );

                            // Remove all ZIPs with a small delay between each
                            for (let i = 0; i < addedZips.length; i++) {
                              const zip = addedZips[i];
                              console.log(
                                `Removing ZIP ${zip} (${i + 1}/${addedZips.length})`,
                              );
                              onZipToggle(zip, "remove");
                              // Small delay between removes
                              if (i < addedZips.length - 1) {
                                await new Promise((resolve) =>
                                  setTimeout(resolve, 200),
                                );
                              }
                            }
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove All ({addedZips.length})
                        </Button>
                      );
                    } else if (hasAvailable) {
                      // Some available - show Add All
                      return (
                        <Button
                          onClick={async () => {
                            if (availableZips.length > 0) {
                              console.log(
                                `Adding all ${availableZips.length} ZIPs without map data`,
                              );

                              // Add all ZIPs with a small delay between each
                              for (let i = 0; i < availableZips.length; i++) {
                                const zip = availableZips[i];
                                console.log(
                                  `Adding ZIP ${zip} (${i + 1}/${availableZips.length})`,
                                );
                                onZipToggle(zip, "add");
                                // Small delay between adds
                                if (i < availableZips.length - 1) {
                                  await new Promise((resolve) =>
                                    setTimeout(resolve, 200),
                                  );
                                }
                              }
                            }
                          }}
                          disabled={!hasAvailable}
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add All ({availableZips.length})
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These ZIPs are associated with the current search but lack
                  polygon data. Add/remove manually.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {searchResult.zipsWithoutGeometry.map((zip) => (
                  <Badge
                    key={zip}
                    variant={
                      zipStatuses[zip] === "added" ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      onZipToggle(
                        zip,
                        zipStatuses[zip] === "added" ? "remove" : "add",
                      )
                    }
                  >
                    {zip}
                    {zipStatuses[zip] === "added" && (
                      <CheckCircle className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

        {searchResult?.suburbanCities &&
          Object.keys(searchResult.suburbanCities).length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Associated Cities & Suburbs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  ZIPs from nearby cities found in your search. Adding these
                  will automatically search for their map boundaries.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(searchResult.suburbanCities)
                  .sort(([cityA], [cityB]) => cityA.localeCompare(cityB))
                  .map(([cityName, cityZips]) => (
                    <div
                      key={cityName}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {cityName}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {cityZips.length} ZIP codes
                            </span>
                          </div>
                          <Button
                            onClick={() => {
                              const cityKey = `${cityName.toLowerCase().replace(/\s+/g, "-")}`;
                              const isVisible =
                                layerRegistry.current.get(
                                  `place-boundary-${cityKey}`,
                                )?.visible ?? true;
                              toggleCityVisibility(cityKey, !isVisible);
                            }}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            {(layerRegistry.current.get(
                              `place-boundary-${cityName.toLowerCase().replace(/\s+/g, "-")}`,
                            )?.visible ?? true)
                              ? "Hide"
                              : "Show"}
                          </Button>
                        </div>
                        {(() => {
                          const availableZips = cityZips.filter(
                            (zip) => zipStatuses[zip] !== "added",
                          );
                          const addedZips = cityZips.filter(
                            (zip) => zipStatuses[zip] === "added",
                          );
                          const hasAvailable = availableZips.length > 0;
                          const hasAdded = addedZips.length > 0;

                          if (hasAdded && !hasAvailable) {
                            // All are added - show Remove All
                            return (
                              <Button
                                onClick={async () => {
                                  console.log(
                                    `Removing all ${addedZips.length} ZIPs from ${cityName}`,
                                  );

                                  // Remove all ZIPs with a small delay between each
                                  for (let i = 0; i < addedZips.length; i++) {
                                    const zip = addedZips[i];
                                    console.log(
                                      `Removing ZIP ${zip} (${i + 1}/${addedZips.length})`,
                                    );
                                    onZipToggle(zip, "remove");
                                    // Small delay between removes
                                    if (i < addedZips.length - 1) {
                                      await new Promise((resolve) =>
                                        setTimeout(resolve, 200),
                                      );
                                    }
                                  }
                                }}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Remove All ({addedZips.length})
                              </Button>
                            );
                          } else if (hasAvailable) {
                            // Some available - show Add All
                            return (
                              <Button
                                onClick={async () => {
                                  if (availableZips.length > 0) {
                                    console.log(
                                      `Adding all ${availableZips.length} ZIPs from ${cityName}`,
                                    );

                                    // First search for the city if not already searched
                                    if (
                                      onSuburbanCitySearch &&
                                      !searchedCities.some(
                                        (city) =>
                                          city.city.toLowerCase() ===
                                            cityName.toLowerCase() &&
                                          city.state ===
                                            searchResult?.searchCriteria.state,
                                      )
                                    ) {
                                      console.log(
                                        `Auto-searching for ${cityName} before adding all ZIPs`,
                                      );
                                      try {
                                        await onSuburbanCitySearch(
                                          cityName,
                                          searchResult?.searchCriteria.state ||
                                            "",
                                        );
                                        // Wait for city to load
                                        await new Promise((resolve) =>
                                          setTimeout(resolve, 1500),
                                        );
                                      } catch (error) {
                                        console.error(
                                          `Failed to search ${cityName}:`,
                                          error,
                                        );
                                      }
                                    }

                                    // Then add all ZIPs with a small delay between each
                                    for (
                                      let i = 0;
                                      i < availableZips.length;
                                      i++
                                    ) {
                                      const zip = availableZips[i];
                                      console.log(
                                        `Adding ZIP ${zip} (${i + 1}/${availableZips.length})`,
                                      );
                                      onZipToggle(zip, "add");
                                      // Small delay between adds to prevent overwhelming the system
                                      if (i < availableZips.length - 1) {
                                        await new Promise((resolve) =>
                                          setTimeout(resolve, 200),
                                        );
                                      }
                                    }
                                  }
                                }}
                                disabled={!hasAvailable}
                                size="sm"
                                variant="outline"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add All ({availableZips.length})
                              </Button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cityZips.map((zip) => (
                          <Badge
                            key={zip}
                            variant={
                              zipStatuses[zip] === "added"
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() =>
                              handleSuburbanZipToggle(
                                zip,
                                cityName,
                                zipStatuses[zip] === "added" ? "remove" : "add",
                              )
                            }
                          >
                            {zip}
                            {zipStatuses[zip] === "added" && (
                              <CheckCircle className="ml-1 h-3 w-3" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
};

export default ZIPSearchMap;
