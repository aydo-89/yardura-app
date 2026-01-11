"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { StyleSpecification } from "maplibre-gl";
import MapLibreMap from "./MapLibreMap";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberSlider } from "@/components/ui/number-slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  MapPin,
  Plus,
  Minus,
  Layers,
  X,
  Search,
  Wand2,
  ChevronDown,
  Minimize2,
  Maximize2,
} from "lucide-react";
import type { ServiceTileStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

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
    county?: GeoJSON.Feature | null;
    countyCities?: GeoJSON.FeatureCollection | null;
  };
  coverageStats: {
    placeAreaSqm: number;
    clipsAreaSqm: number;
    ratio: number;
    coveragePercent: number;
  };
  zipsWithoutGeometry?: string[];
  zipsByCity?: Record<string, string[]>;
  suburbanCities?: Record<string, string[]>;
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

interface MapLocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

interface MapStateOption {
  code: string;
  name: string;
}

interface SearchedCity {
  id: string;
  city: string;
  state: string;
  searchType: "city" | "county";
  searchResult: ZIPSearchResult;
}

interface ZIPSearchMapProps {
  searchResult: ZIPSearchResult | null;
  serviceAreaData: ServiceAreaData | null;
  zipStatuses: Record<string, "available" | "added" | "adding" | "removing" | "error">;
  searchedCities: SearchedCity[];
  activeSavedSearchId?: string | null;
  zipMetadata?: Record<string, unknown>;
  selectedTile?: unknown;
  allServiceAreas?: unknown[];
  onZipToggle: (zip: string, action: "add" | "remove") => void;
  onBulkAdd: (zips: string[]) => void;
  onClearAll: () => void;
  onClearSearchedCities: () => void;
  onLoadSavedSearch?: (saved: SearchedCity) => void;
  onDeleteSavedSearch?: (id: string) => void;
  onFocusZip?: (zip: string) => void;
  tileCount: number;
  onTileCountChange: (value: number) => void;
  canGenerateTiles: boolean;
  onGenerateTiles: () => void;
  isGeneratingTiles: boolean;
  generationMode: "cluster" | "perZip";
  onGenerationModeChange: (mode: "cluster" | "perZip") => void;
  availableZipCount: number;
  placeDetailsLoading: boolean;
  loading?: boolean;
  showMaps?: boolean;
  mapStyle?: string | StyleSpecification;
  mapStyleId?: string;
  mapStyleMode?: string;
  mapStyleOptions?: Array<{ value: string; label: string }>;
  onMapStyleModeChange?: (mode: string) => void;
  onOpenMobileMapActions?: () => void;
  draftTiles?: unknown[];
  selectedDraftTileId?: string | null;
  placeGeometry?: GeoJSON.Feature | null;
  placeZipFeatures?: GeoJSON.FeatureCollection | null;
  mapId?: string;
  showTileLabels?: boolean;
  onToggleTileLabels?: (value: boolean) => void;
  showMunicipalityLabels?: boolean;
  onToggleMunicipalityLabels?: (value: boolean) => void;
  municipalityToggleLabel?: string;
  showZipLabels?: boolean;
  onToggleZipLabels?: (value: boolean) => void;
  showPopulation?: boolean;
  onTogglePopulation?: (value: boolean) => void;
  searchMode: "city" | "county";
  onSearchModeChange: (mode: "city" | "county") => void;
  stateOptions: MapStateOption[];
  stateFilter: string;
  onStateFilterChange: (state: string) => void;
  locationQuery: string;
  onLocationQueryChange: (value: string) => void | Promise<void>;
  onLocationInputFocus: () => void;
  locationOptions: MapLocationOption[];
  showLocationOptions: boolean;
  onSelectLocation: (option: MapLocationOption) => void;
  onClearLocation: () => void;
  selectedLocationLabel: string | null;
  selectedLocationType: "city" | "county" | null;
  isSearching: boolean;
  suggestionsLoading: boolean;
  onSearchLocation: () => void | Promise<void>;
  selectedLocation?: MapLocationOption | null;
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  className?: string;
  mapContainerClassName?: string;
}

const STATUS_LABELS: Array<{ value: ServiceTileStatus; label: string; color: string }> = [
  { value: "LIVE", label: "Live", color: "bg-emerald-500" },
  { value: "WAITLIST", label: "Waitlist", color: "bg-amber-400" },
  { value: "SUSPENDED", label: "Paused", color: "bg-red-500" },
];

const ZIPSearchMap = ({
  searchResult,
  serviceAreaData,
  zipStatuses,
  searchedCities,
  activeSavedSearchId,
  onZipToggle,
  onBulkAdd,
  onClearAll,
  onClearSearchedCities,
  onLoadSavedSearch,
  onDeleteSavedSearch,
  onFocusZip,
  tileCount,
  onTileCountChange,
  canGenerateTiles,
  onGenerateTiles,
  isGeneratingTiles,
  generationMode,
  onGenerationModeChange,
  availableZipCount,
  placeDetailsLoading,
  loading = false,
  showMaps = true,
  mapStyle,
  mapStyleId,
  mapStyleMode = "auto",
  mapStyleOptions,
  onMapStyleModeChange,
  onOpenMobileMapActions,
  mapId = "tile-studio-map",
  showTileLabels = true,
  onToggleTileLabels,
  showMunicipalityLabels = true,
  onToggleMunicipalityLabels,
  municipalityToggleLabel = "City labels",
  showZipLabels = false,
  onToggleZipLabels,
  showPopulation = false,
  onTogglePopulation,
  searchMode,
  onSearchModeChange,
  stateOptions,
  stateFilter,
  onStateFilterChange,
  locationQuery,
  onLocationQueryChange,
  onLocationInputFocus,
  locationOptions,
  showLocationOptions,
  onSelectLocation,
  onClearLocation,
  selectedLocationLabel,
  selectedLocationType,
  isSearching,
  suggestionsLoading,
  onSearchLocation,
  selectedLocation,
  title,
  description,
  headerActions,
  className,
  mapContainerClassName,
}: ZIPSearchMapProps) => {
  const coveragePercentDisplay = useMemo(() => {
    const raw = searchResult?.coverageStats.coveragePercent;
    if (raw === null || raw === undefined) return "–";
    return `${Number(raw).toFixed(1)}%`;
  }, [searchResult]);

  const availableZips = searchResult?.zips ?? [];
  const hasResult = Boolean(searchResult);
  const computedTitle = title
    ?? selectedLocationLabel
    ?? (hasResult
      ? `${searchResult!.searchCriteria.city}, ${searchResult!.searchCriteria.state}`
      : "Tile Coverage Workspace");
  const computedDescription = description ??
    (hasResult
      ? searchResult!.message
      : "Visualize draft tiles, published coverage, and ZIP assignments.");

  const plannedTileGenerationCount = generationMode === "perZip"
    ? availableZipCount
    : tileCount;

  const [zipListExpanded, setZipListExpanded] = useState(false);
  const [layerPanelCollapsed, setLayerPanelCollapsed] = useState(false);
  const [showAllZips, setShowAllZips] = useState(false);

  useEffect(() => {
    setZipListExpanded(false);
  }, [searchResult]);

  const hasZipResults = availableZips.length > 0;
  const statusBadges = useMemo(() => {
    return STATUS_LABELS.map((item) => (
      <span
        key={item.value}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
      >
        <span className={`inline-flex h-3 w-3 rounded-full ${item.color}`} />
        {item.label}
      </span>
    ));
  }, []);

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "overflow-hidden border border-slate-200/70 bg-white/98 shadow-lg backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/85",
          className,
        )}
      >
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-300 text-blue-700 dark:from-blue-900/50 dark:to-blue-800/50 dark:text-blue-200">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  {computedTitle}
                </CardTitle>
                {computedDescription ? (
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    {computedDescription}
                  </CardDescription>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {headerActions}
              {mapStyleOptions?.length && onMapStyleModeChange ? (
                <>
                  <Select value={mapStyleMode} onValueChange={onMapStyleModeChange}>
                    <SelectTrigger className="h-10 w-[160px] rounded-xl border-slate-300 bg-white text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <SelectValue placeholder="Map style" />
                    </SelectTrigger>
                    <SelectContent className="w-[200px]">
                      {mapStyleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!headerActions ? (
                    <Button
                      variant="outline"
                      className="hidden rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex"
                      size="sm"
                      onClick={onOpenMobileMapActions}
                    >
                      <Layers className="mr-2 h-4 w-4" /> Map actions
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {hasResult ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <Badge variant="secondary" className="rounded-full border border-slate-200/80 dark:border-slate-700">
                {availableZips.length.toLocaleString()} ZIPs
              </Badge>
              <span>Coverage: {coveragePercentDisplay}</span>
              <span>Place area: {Math.round(searchResult!.coverageStats.placeAreaSqm).toLocaleString()} m²</span>
              <span>Clipped area: {Math.round(searchResult!.coverageStats.clipsAreaSqm).toLocaleString()} m²</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">{statusBadges}</div>
        </CardHeader>

        <CardContent className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={cn(
            "relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
            mapContainerClassName,
          )}>
            <MapLibreMap
              id={mapId}
              className="h-full w-full"
              style={mapStyle}
              styleKey={mapStyleId}
            />
            {isGeneratingTiles ? (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating draft tiles…
                </span>
              </div>
            ) : null}
            <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-3">
              <div
                className={cn(
                  "pointer-events-auto rounded-xl border border-slate-200/80 bg-white/95 shadow-md transition-all dark:border-slate-700 dark:bg-slate-900/90",
                  layerPanelCollapsed ? "w-auto p-2" : "w-60 p-3",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200",
                    layerPanelCollapsed ? "mb-0" : "mb-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {!layerPanelCollapsed ? <span>Layers</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLayerPanelCollapsed((prev) => !prev)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-200"
                    aria-label={layerPanelCollapsed ? "Expand layer controls" : "Collapse layer controls"}
                  >
                    {layerPanelCollapsed ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Minimize2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {!layerPanelCollapsed ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onToggleTileLabels?.(!showTileLabels)}
                      disabled={!onToggleTileLabels}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                        showTileLabels
                          ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-200",
                        !onToggleTileLabels && "opacity-60",
                      )}
                    >
                      <span>Tile names</span>
                      <span
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          showTileLabels ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            showTileLabels ? "translate-x-5" : "translate-x-1",
                          )}
                        />
                      </span>
                    </button>

                    {onToggleMunicipalityLabels ? (
                      <button
                        type="button"
                        onClick={() => onToggleMunicipalityLabels(!showMunicipalityLabels)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                          showMunicipalityLabels
                            ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover-border-emerald-400 dark:hover:text-emerald-200",
                        )}
                      >
                        <span>{municipalityToggleLabel}</span>
                        <span
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            showMunicipalityLabels
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-600",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                              showMunicipalityLabels ? "translate-x-5" : "translate-x-1",
                            )}
                          />
                        </span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onToggleZipLabels?.(!showZipLabels)}
                      disabled={!onToggleZipLabels}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                        showZipLabels
                          ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-slate-200 bg-white text-slate-600 hover-border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover-border-emerald-400 dark:hover:text-emerald-200",
                        !onToggleZipLabels && "opacity-60",
                      )}
                    >
                      <span>ZIP codes</span>
                      <span
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          showZipLabels ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            showZipLabels ? "translate-x-5" : "translate-x-1",
                          )}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTogglePopulation?.(!showPopulation)}
                      disabled={!onTogglePopulation}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                        showPopulation
                          ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-slate-200 bg-white text-slate-600 hover-border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover-border-emerald-400 dark:hover:text-emerald-200",
                        !onTogglePopulation && "opacity-60",
                      )}
                    >
                      <span>Population</span>
                      <span
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          showPopulation ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            showPopulation ? "translate-x-5" : "translate-x-1",
                          )}
                        />
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>

              {!layerPanelCollapsed ? (
                <div className="pointer-events-auto w-60 rounded-xl border border-slate-200/80 bg-white/95 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                  <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
                    Map legend
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                      <span>Waitlist tile (pre-launch)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span>Live tile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                      <span>Waitlist tile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-500" />
                      <span>Paused tile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-slate-400" />
                      <span>ZIP coverage</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-4">
              <div
                className={cn(
                  "pointer-events-auto w-full max-w-[min(960px,100%)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl transition-all dark:border-slate-700 dark:bg-slate-900/90",
                  zipListExpanded
                    ? "backdrop-blur-md"
                    : "backdrop-blur-sm",
                )}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setZipListExpanded((prev) => !prev)}
                    aria-expanded={zipListExpanded}
                    className="flex items-center gap-2 text-left text-sm font-semibold text-slate-800 transition hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-slate-200"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        zipListExpanded ? "rotate-0" : "-rotate-90",
                      )}
                    />
                    <span>ZIP codes found</span>
                    {!zipListExpanded && hasZipResults ? (
                      <span className="text-xs font-normal uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Expand to review assignments
                      </span>
                    ) : null}
                  </button>
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-300 text-xs dark:border-slate-600"
                  >
                    {availableZips.length.toLocaleString()}
                  </Badge>
                </div>

                {zipListExpanded ? (
                  <>
                    <div className="border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="max-h-[160px] overflow-y-auto px-4 py-3">
                        {availableZips.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Search for a {searchMode === "county" ? "county" : "city"} to load ZIPs.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(zipListExpanded && showAllZips
                              ? availableZips
                              : availableZips.slice(0, 12)
                            ).map((zip) => (
                              <button
                                key={zip}
                                type="button"
                                onClick={() => onFocusZip?.(zip)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-3 py-1.5 text-xs shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30"
                                title={`Zoom to ZIP ${zip} on map`}
                              >
                                <Badge
                                  variant="secondary"
                                  className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                >
                                  {zip}
                                </Badge>
                                <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {zipListExpanded && availableZips.length > 12 ? (
                        <div className="border-t border-slate-200/60 px-4 py-2 text-right text-xs dark:border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => setShowAllZips((prev) => !prev)}
                            className="rounded-full px-3 py-1 text-emerald-600 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            {showAllZips ? "Show fewer" : `Show all ${availableZips.length.toLocaleString()}`}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {serviceAreaData ? (
                      <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 px-4 py-3 text-xs text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            Tiles
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {serviceAreaData.stats.totalGroups.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            Covered ZIPs
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {serviceAreaData.stats.totalZips.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-slate-900/70">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-6 py-4 shadow-md dark:bg-slate-900">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Loading coverage data…
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex h-full flex-col gap-4">
            <div className="rounded-xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Search markets
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Find a city or county to preview coverage and queue tiles.
                  </p>
                </div>
                {selectedLocationLabel ? (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {selectedLocationLabel}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1 transition",
                    searchMode === "city"
                      ? "bg-white shadow-sm dark:bg-slate-900/80"
                      : "opacity-70 hover:opacity-100",
                  )}
                  onClick={() => onSearchModeChange("city")}
                >
                  City
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1 transition",
                    searchMode === "county"
                      ? "bg-white shadow-sm dark:bg-slate-900/80"
                      : "opacity-70 hover:opacity-100",
                  )}
                  onClick={() => onSearchModeChange("county")}
                >
                  County
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {searchMode === "county" ? "County" : "City"}
                    </Label>
                    <div className="relative mt-1" data-autocomplete>
                      <Input
                        value={locationQuery}
                        onChange={(event) => onLocationQueryChange(event.target.value)}
                        onFocus={onLocationInputFocus}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (selectedLocation) {
                              void onSearchLocation();
                            }
                          }
                        }}
                        placeholder={
                          searchMode === "county"
                            ? "e.g., Maricopa County"
                            : "e.g., Dallas, TX"
                        }
                        className="h-11 rounded-xl"
                      />
                      {showLocationOptions ? (
                        <div className="absolute top-full left-0 right-0 z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-900/90">
                          {suggestionsLoading ? (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> Searching…
                            </div>
                          ) : null}
                          {!suggestionsLoading && locationOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                              {locationQuery.trim().length < 2
                                ? "Type at least two characters to search."
                                : "No matching markets yet."}
                            </div>
                          ) : null}
                          {locationOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:bg-slate-800/70"
                              onClick={() => onSelectLocation(option)}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {option.label}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="capitalize">{option.type}</span>
                                </div>
                              </div>
                              <MapPin className="ml-4 h-4 w-4 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="sm:w-[140px]">
                    <Label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      State
                    </Label>
                    <Select value={stateFilter} onValueChange={onStateFilterChange}>
                      <SelectTrigger className="mt-1 h-11 w-full rounded-xl border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="ALL">All states</SelectItem>
                        {stateOptions.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedLocationLabel ? (
                      <span>
                        Ready to search {selectedLocationType === "county" ? "county" : "city"} coverage.
                      </span>
                    ) : (
                      <span>Choose a location to preview ZIP coverage.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs text-slate-500 hover:text-rose-500"
                      onClick={onClearLocation}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                      onClick={() => void onSearchLocation()}
                      disabled={!selectedLocation || isSearching}
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" /> Search
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {selectedLocation ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                  <Badge variant="outline" className="capitalize">
                    {selectedLocation.type}
                  </Badge>
                  <span>
                    Approx. {selectedLocation.zipCount.toLocaleString()} ZIPs in selection
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Generate draft tiles
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    City selection required
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {selectedLocationType ?? " - "}
                </Badge>
              </div>

              <div className="space-y-2">
                <RadioGroup
                  value={generationMode}
                  onValueChange={(value) => onGenerationModeChange(value as "cluster" | "perZip")}
                  className="grid gap-2"
                >
                  <label
                    htmlFor="map-generation-mode-cluster"
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left transition",
                      generationMode === "cluster"
                        ? "border-emerald-500/70 bg-white text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-slate-200/80 bg-white/90 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-200",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem id="map-generation-mode-cluster" value="cluster" className="mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Smart clusters</p>
                        <p className="text-[11px] opacity-80">
                          Split the city into {tileCount} balanced tile{tileCount === 1 ? "" : "s"}.
                        </p>
                      </div>
                    </div>
                  </label>
                  <label
                    htmlFor="map-generation-mode-per-zip"
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left transition",
                      generationMode === "perZip"
                        ? "border-emerald-500/70 bg-white text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-slate-200/80 bg-white/90 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-200",
                      availableZipCount === 0 && "opacity-60 hover:border-slate-200/80 hover:text-slate-600 dark:hover:border-slate-700 dark:hover:text-slate-300",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        id="map-generation-mode-per-zip"
                        value="perZip"
                        disabled={availableZipCount === 0}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">One per ZIP</p>
                        <p className="text-[11px] opacity-80">
                          {availableZipCount > 0
                            ? `Creates ${availableZipCount.toLocaleString()} tile${availableZipCount === 1 ? "" : "s"}.`
                            : "Run a search to load ZIPs for this option."}
                        </p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {generationMode === "cluster" ? (
                <NumberSlider
                  min={1}
                  max={24}
                  step={1}
                  value={tileCount}
                  onChange={onTileCountChange}
                  disabled={!canGenerateTiles || isGeneratingTiles || loading}
                />
              ) : (
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  Generates one draft per ZIP ({availableZipCount.toLocaleString()} total).
                </div>
              )}

              <Button
                className="h-9 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={onGenerateTiles}
                disabled={
                  !canGenerateTiles ||
                  isGeneratingTiles ||
                  loading ||
                  plannedTileGenerationCount === 0
                }
              >
                {isGeneratingTiles || placeDetailsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" /> Generate {plannedTileGenerationCount.toLocaleString()} tile
                    {plannedTileGenerationCount === 1 ? "" : "s"}
                  </>
                )}
              </Button>

              {!canGenerateTiles ? (
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Select a city to enable the generator
                </p>
              ) : null}
            </div>


            {searchedCities.length ? (
              <div
                id="saved-searches"
                className="rounded-xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Saved searches
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-rose-500"
                    onClick={onClearSearchedCities}
                  >
                    <X className="mr-1 h-4 w-4" /> Clear
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {searchedCities.map((city) => {
                    const isActive = activeSavedSearchId === city.id;
                    return (
                      <div key={city.id} className="flex items-center gap-1">
                        <Button
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "rounded-full border-slate-200 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-slate-700",
                            isActive
                              ? "bg-emerald-500 text-white hover:bg-emerald-400 dark:bg-emerald-500"
                              : "bg-white/80 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:bg-slate-900/70 dark:text-slate-300",
                          )}
                          onClick={() => onLoadSavedSearch?.(city)}
                        >
                          <MapPin className="mr-1 h-3.5 w-3.5" /> {city.city}, {city.state}
                        </Button>
                        {onDeleteSavedSearch ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteSavedSearch(city.id);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:text-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:text-slate-500 dark:hover:text-rose-300"
                            aria-label={`Delete saved search ${city.city}, ${city.state}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ZIPSearchMap;
