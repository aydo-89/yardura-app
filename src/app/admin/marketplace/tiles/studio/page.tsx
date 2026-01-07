"use client";

import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberSlider } from "@/components/ui/number-slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Search,
  Loader2,
  X,
  MapPin,
  Globe2,
  Wand2,
  ChevronDown,
  ChevronUp,
  History,
  Layers,
  Maximize2,
  Minimize2,
  Palette,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ZIPSearchMap, {
  ZIPSearchResult,
  ServiceAreaData,
} from "@/components/maps/ZIPSearchMap";
import type { ServiceAreaSummary } from "@/lib/tiles/service-areas";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { StyleSpecification } from "maplibre-gl";
import type * as GeoJSON from "geojson";
import { toast } from "sonner";
import type { DraftTile } from "@/lib/tiles/studio-types";
import type { PlaceSearchResult } from "@/lib/geo/types";
import {
  fetchDraftTiles as fetchDraftTilesApi,
  generateDraftTiles,
  deleteDraftTile as deleteDraftTileApi,
  publishDraftTile as publishDraftTileApi,
  deleteServiceTile,
  publishServiceTileOffers,
  renameServiceTile,
} from "@/lib/tiles/studio-client";

interface ZipStatus {
  [zipCode: string]: "available" | "added" | "adding" | "removing" | "error";
}

type MapStyleMode = "auto" | "light" | "dark" | "satellite";

type ZipMetadataEntry = {
  slug: string | null;
  status: ServiceAreaSummary["tile"]["status"] | null;
  activationEligible: boolean | null;
  advisories: string[];
  eligible: boolean;
  estimatedDelivery: string | null;
  zoneName: string | null;
};

type ZipMetadataMap = Record<string, ZipMetadataEntry>;

const MAP_STYLE_STORAGE_KEY = "yardura-service-areas-map-style";
const MAP_ID = "tile-studio-map";
const CUSTOM_TILE_COLORS_STORAGE_KEY = "yardura-tile-studio-colors";

const PUBLISHED_STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  LIVE: { fill: "#22c55e", stroke: "#15803d" },
  WAITLIST: { fill: "#facc15", stroke: "#b45309" },
  SUSPENDED: { fill: "#f97316", stroke: "#c2410c" },
  DRAFT: { fill: "#64748b", stroke: "#475569" },
};

const OSM_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "openstreetmap",
    },
  ],
};

const CUSTOM_MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL &&
  process.env.NEXT_PUBLIC_MAP_STYLE_URL.trim().length > 0
    ? process.env.NEXT_PUBLIC_MAP_STYLE_URL.trim()
    : null;

const DEFAULT_LIGHT_MAP_STYLE: string | StyleSpecification =
  CUSTOM_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const DEFAULT_DARK_MAP_STYLE: string | StyleSpecification =
  CUSTOM_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "esri-world-imagery",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
    },
  ],
};

const MAP_STYLE_OPTIONS: Array<{ value: MapStyleMode; label: string }> = [
  { value: "auto", label: "Match theme" },
  { value: "light", label: "Light streets" },
  { value: "dark", label: "Dark streets" },
  { value: "satellite", label: "Satellite" },
];

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

type TileStatus = ServiceAreaSummary["tile"]["status"];

const PUBLISHABLE_STATUSES: TileStatus[] = ["WAITLIST", "LIVE", "SUSPENDED"];

interface LocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

type CountySuggestion = {
  countyId: string;
  name: string;
  state: string;
  placeCount: number;
  totalPopulation: number;
};

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
  id: string;
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
    const parsed: SearchedCity[] = persisted ? JSON.parse(persisted) : [];
    return parsed.map((entry, index) => ({
      ...entry,
      id:
        typeof entry.id === "string" && entry.id.trim().length > 0
          ? entry.id
          : `${entry.searchType ?? "city"}-${(entry.city ?? "").toLowerCase()}-${
              (entry.state ?? "").toUpperCase()
            }-${index}`,
    }));
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

function loadCustomTileColors(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_TILE_COLORS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
    );
  } catch (error) {
    console.warn("Failed to load custom tile colors", error);
    return {};
  }
}

function persistCustomTileColors(colors: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_TILE_COLORS_STORAGE_KEY,
      JSON.stringify(colors),
    );
  } catch (error) {
    console.warn("Failed to persist custom tile colors", error);
  }
}

export default function TileStudioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme } = useTheme();

  // All useState hooks MUST be called before any conditional logic
  const [selectedLocation, setSelectedLocation] =
    useState<LocationOption | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [searchMode, setSearchMode] = useState<"city" | "county">("city");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ZIPSearchResult | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zipStatuses, setZipStatuses] = useState<ZipStatus>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedCities, setSearchedCities] = useState<SearchedCity[]>([]);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const [customTileColors, setCustomTileColors] = useState<Record<string, string>>({});
  const [selectedTileSlugs, setSelectedTileSlugs] = useState<string[]>([]);
  const [colorPickerValue, setColorPickerValue] = useState("#22c55e");
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>("auto");
  const [isMobileMapSheetOpen, setIsMobileMapSheetOpen] = useState(false);
  const [selectedTileSlug, setSelectedTileSlug] = useState<string | null>(null);
  const [zipMetadata, setZipMetadata] = useState<ZipMetadataMap>({});
  const [serviceAreasLoading, setServiceAreasLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [conflictSummary, setConflictSummary] = useState({
    tilesWithConflicts: 0,
    conflictZipTotal: 0,
    conflictZips: [] as string[],
  });
  const [showTileLabels, setShowTileLabels] = useState(true);
  const [showZipLabels, setShowZipLabels] = useState(false);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showCountyCityLabels, setShowCountyCityLabels] = useState(true);
  const [draftsCollapsed, setDraftsCollapsed] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [draftFilter, setDraftFilter] = useState("");
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [publishedFilter, setPublishedFilter] = useState("");
  const [showAllPublished, setShowAllPublished] = useState(false);
  const [editingPublishedSlug, setEditingPublishedSlug] = useState<string | null>(null);
  const [editingPublishedName, setEditingPublishedName] = useState("");
  const [renamingPublishedSlug, setRenamingPublishedSlug] = useState<string | null>(null);
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const conflictToastTotalRef = useRef<number>(0);
  const mapFitGeometryRef = useRef<GeoJSON.Feature | GeoJSON.FeatureCollection | null>(null);
  const mapFocusFeatureRef = useRef<GeoJSON.Feature | GeoJSON.FeatureCollection | null>(null);
  const shouldFitViewRef = useRef(false);
  const focusLockRef = useRef<{ until: number } | null>(null);
  const draftViewStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const publishedViewStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const mapViewStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const focusHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistentHighlightRef = useRef(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const lastMapFocusRef = useRef<string | null>(null);
  const zipStatusesSerializedRef = useRef<string>("");
  const previousZipStatusesRef = useRef<ZipStatus>(zipStatuses);
  
  // Memoize zipStatuses to prevent unnecessary map re-renders
  // Only update when the actual content changes, not just the object reference
  const stableZipStatuses = useMemo(() => {
    const serialized = JSON.stringify(zipStatuses);
    if (serialized === zipStatusesSerializedRef.current) {
      // Return the same reference if content hasn't changed
      return previousZipStatusesRef.current;
    }
    zipStatusesSerializedRef.current = serialized;
    previousZipStatusesRef.current = zipStatuses;
    return zipStatuses;
  }, [zipStatuses]);
  const [placeDetails, setPlaceDetails] = useState<PlaceSearchResult | null>(null);
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState(false);
  const [draftTiles, setDraftTiles] = useState<DraftTile[]>([]);
  const [draftTilesLoading, setDraftTilesLoading] = useState(false);
  const [tileCount, setTileCount] = useState<number>(4);
  const [generationMode, setGenerationMode] = useState<"cluster" | "perZip">("cluster");
  const [isGeneratingTiles, setIsGeneratingTiles] = useState(false);
  const [selectedDraftTileId, setSelectedDraftTileId] = useState<string | null>(null);
  const [draftTotalCount, setDraftTotalCount] = useState(0);
  const [publishStatus, setPublishStatus] = useState<TileStatus>("WAITLIST");
  const [placeGeometry, setPlaceGeometry] = useState<GeoJSON.Feature | null>(null);
  const [placeZipFeatures, setPlaceZipFeatures] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [countyGeometry, setCountyGeometry] = useState<GeoJSON.Feature | null>(null);
  const [countyCityFeatures, setCountyCityFeatures] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [draftActionPendingId, setDraftActionPendingId] = useState<string | null>(null);
  const [draftActionPendingType, setDraftActionPendingType] = useState<"delete" | "publish" | null>(null);
  const [deleteTilePendingSlug, setDeleteTilePendingSlug] = useState<string | null>(null);

  const draftPagesLoadedRef = useRef<Set<number>>(new Set());

  const lockMapFocus = useCallback((duration: number = 2000) => {
    focusLockRef.current = { until: Date.now() + duration };
    shouldFitViewRef.current = false;
  }, []);

  const setTileLabelVisibility = useCallback(
    (value: boolean) => {
      lockMapFocus(1200);
      setShowTileLabels(value);
    },
    [lockMapFocus],
  );

  const setZipLabelVisibility = useCallback(
    (value: boolean) => {
      lockMapFocus(1200);
      setShowZipLabels(value);
    },
    [lockMapFocus],
  );

  const setPopulationVisibility = useCallback(
    (value: boolean) => {
      lockMapFocus(1200);
      setShowPopulation(value);
    },
    [lockMapFocus],
  );

  const setMunicipalityLabelVisibility = useCallback(
    (value: boolean) => {
      lockMapFocus(1200);
      setShowCountyCityLabels(value);
    },
    [lockMapFocus],
  );

  // Compute businessId after hooks but before conditional returns
  const businessId = (session?.user as any)?.orgId || "yardura";
  const resolvedTheme = theme;

  const serviceAreaCacheRef = useRef<
    | {
        timestamp: number;
        areas: ServiceAreaSummary[];
        statusCounts: Record<string, number>;
        conflictSummary: {
          tilesWithConflicts: number;
          conflictZipTotal: number;
          conflictZips: string[];
        };
      }
    | null
  >(null);
  const scrollToMap = useCallback(() => {
    if (typeof document === "undefined") return;
    const anchor = document.getElementById("tile-studio-map-anchor");
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const syncZipStateFromAreas = useCallback((areas: ServiceAreaSummary[]) => {
    const assignedZipSet = new Set<string>();

    setZipMetadata((prev) => {
      const next: ZipMetadataMap = {};
      areas.forEach((area) => {
        area.zips.forEach((zipEntry) => {
          assignedZipSet.add(zipEntry.zip);
          const previous = prev[zipEntry.zip];
          next[zipEntry.zip] = {
            slug: area.tile.slug,
            status: area.tile.status,
            activationEligible: area.tile.status === "LIVE",
            advisories: previous?.advisories ?? [],
            eligible:
              area.tile.status === "LIVE" || Boolean(previous?.eligible),
            estimatedDelivery: previous?.estimatedDelivery ?? null,
            zoneName: area.tile.name,
          };
        });
      });
      return next;
    });

    setZipStatuses((prev: ZipStatus) => {
      const next: ZipStatus = { ...prev };
      assignedZipSet.forEach((zip) => {
        next[zip] = "added";
      });
      Object.keys(next).forEach((zip) => {
        if (!assignedZipSet.has(zip) && next[zip] === "added") {
          next[zip] = "available";
        }
      });
      return next;
    });
  }, []);

  const flashFocusGeometry = useCallback(
    (
      feature: GeoJSON.Feature | GeoJSON.FeatureCollection | null,
      options?: { persist?: boolean },
    ) => {
      if (typeof window === "undefined") return;
      const mapApi = (window as any)[`maplibre_${MAP_ID}`];
      if (!mapApi) return;

      const highlightLayerId = "tile-studio-focus-highlight";
      const removeHighlight = () => {
        try {
          mapApi.removeLayer?.(highlightLayerId);
        } catch (error) {
          console.warn("Failed to remove focus highlight", error);
        }
        persistentHighlightRef.current = false;
      };

      if (!feature) {
        if (focusHighlightTimeoutRef.current) {
          clearTimeout(focusHighlightTimeoutRef.current);
          focusHighlightTimeoutRef.current = null;
        }
        removeHighlight();
        return;
      }

      if (!mapApi.addGeoJsonLayer) {
        return;
      }

      const persist = options?.persist ?? false;

      try {
        mapApi.addGeoJsonLayer({
          id: highlightLayerId,
          data: feature,
          fillColor: "#0ea5e9",
          fillOpacity: 0,
          strokeColor: "#0ea5e9",
          strokeWidth: 2,
          strokeOpacity: 0.6,
        });

        const mapInstance: any = mapApi.map;
        if (mapInstance?.setPaintProperty) {
          mapInstance.setPaintProperty(highlightLayerId, "fill-opacity", 0);
          mapInstance.setPaintProperty(`${highlightLayerId}-stroke`, "line-opacity", 0.6);
          mapInstance.setPaintProperty(`${highlightLayerId}-stroke`, "line-width", 2);
        }

        if (focusHighlightTimeoutRef.current) {
          clearTimeout(focusHighlightTimeoutRef.current);
          focusHighlightTimeoutRef.current = null;
        }

        if (persist) {
          persistentHighlightRef.current = true;
        } else {
          persistentHighlightRef.current = false;
          focusHighlightTimeoutRef.current = setTimeout(() => {
            removeHighlight();
          }, 900);
        }
      } catch (error) {
        console.warn("Failed to render focus highlight", error);
      }
    },
    [],
  );

  // Get selected tile data
  const selectedTile = useMemo(() => {
    if (!selectedTileSlug) return null;
    return serviceAreas.find((area) => area.tile.slug === selectedTileSlug) ?? null;
  }, [selectedTileSlug, serviceAreas]);

  const selectedDraftTile = useMemo(() => {
    if (!selectedDraftTileId) return null;
    return draftTiles.find((tile) => tile.tileId === selectedDraftTileId) ?? null;
  }, [draftTiles, selectedDraftTileId]);

  const clearSelectedLocation = useCallback(() => {
    setSelectedLocation(null);
    setLocationQuery("");
    setResults(null);
    setHasSearched(false);
    setPlaceGeometry(null);
    setPlaceZipFeatures(null);
    setCountyGeometry(null);
    setCountyCityFeatures(null);
    setShowLocationOptions(false);
    setActiveSavedSearchId(null);
    setGenerationMode("cluster");
    setTileCount(4);
    shouldFitViewRef.current = false;
    mapFocusFeatureRef.current = null;
    lastMapFocusRef.current = null;
    flashFocusGeometry(null);
  }, [flashFocusGeometry]);

  useEffect(() => {
    if (!draftTiles.length) {
      setSelectedDraftTileId(null);
      return;
    }

    if (!selectedDraftTileId && !hasSearched && !mapFocusFeatureRef.current) {
      setSelectedDraftTileId(draftTiles[0].tileId);
      return;
    }

    const exists = draftTiles.some((tile) => tile.tileId === selectedDraftTileId);
    if (!exists) {
      if (hasSearched || mapFocusFeatureRef.current) {
        setSelectedDraftTileId(null);
      } else {
        setSelectedDraftTileId(draftTiles[0].tileId);
      }
    }
  }, [draftTiles, selectedDraftTileId, hasSearched]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY) as
      | MapStyleMode
      | null;
    if (saved && MAP_STYLE_OPTIONS.some((option) => option.value === saved)) {
      setMapStyleMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleMode);
  }, [mapStyleMode]);

  useEffect(() => {
    return () => {
      if (focusHighlightTimeoutRef.current) {
        clearTimeout(focusHighlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMapExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mapInstance = (window as any)[`maplibre_${MAP_ID}`];
    const map = mapInstance?.map;
    if (!map) {
      return;
    }

    const resize = () => {
      try {
        map.resize();
      } catch (error) {
        console.warn("Map resize failed", error);
      }
    };

    resize();
    const timer = window.setTimeout(resize, 160);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mapInstance = (window as any)[`maplibre_${MAP_ID}`]?.map;
    if (!mapInstance) return;

    const updateViewState = () => {
      try {
        const currentCenter = mapInstance.getCenter();
        mapViewStateRef.current = {
          center: [currentCenter.lng, currentCenter.lat],
          zoom: mapInstance.getZoom(),
        };
      } catch (error) {
        console.warn("Failed to capture map view state", error);
      }
    };

    updateViewState();
    mapInstance.on("moveend", updateViewState);
    mapInstance.on("zoomend", updateViewState);
    mapInstance.on("pitchend", updateViewState);

    return () => {
      mapInstance.off("moveend", updateViewState);
      mapInstance.off("zoomend", updateViewState);
      mapInstance.off("pitchend", updateViewState);
    };
  }, [mapStyleMode, resolvedTheme]);

  useEffect(() => {
    const mapInstance = (window as any)[`maplibre_${MAP_ID}`];
    const map = mapInstance?.map;

    let didRefitDraft = false;
    const preserveDraftView = !shouldFitViewRef.current;

    if (preserveDraftView && map) {
      if (mapViewStateRef.current) {
        draftViewStateRef.current = mapViewStateRef.current;
      } else {
        try {
          const currentCenter = map.getCenter();
          draftViewStateRef.current = {
            center: [currentCenter.lng, currentCenter.lat],
            zoom: map.getZoom(),
          };
        } catch (error) {
          draftViewStateRef.current = null;
          console.warn("Failed to capture draft view before layer update", error);
        }
      }
    } else {
      draftViewStateRef.current = null;
    }

    const placeLayerId = "tile-studio-place";
    const zctaLayerId = "tile-studio-zips";
    const countyLayerId = "tile-studio-county";
    const countyCityLayerId = "tile-studio-county-cities";
    const countyCityLabelLayerId = "tile-studio-county-city-labels";
    const countyCityLabelSourceId = `${countyCityLabelLayerId}-source`;
    const draftLayerId = "tile-studio-drafts";
    const draftSelectedLayerId = "tile-studio-draft-selected";

    const removeLayer = (id: string) => {
      if (!mapInstance?.removeLayer) return;
      try {
        mapInstance.removeLayer(id);
      } catch (error) {
        // ignore missing layers
      }
    };

    if (!mapInstance || !map) {
      return;
    }

    const applyLayers = () => {
      [
        placeLayerId,
        zctaLayerId,
        countyLayerId,
        countyCityLayerId,
        draftLayerId,
        draftSelectedLayerId,
      ].forEach(
        removeLayer,
      );

      if (countyGeometry) {
        try {
          mapInstance.addGeoJsonLayer({
            id: countyLayerId,
            data: countyGeometry,
            fillColor: "#1d4ed8",
            fillOpacity: 0.08,
            strokeColor: "#1d4ed8",
            strokeWidth: 2.5,
            strokeOpacity: 0.9,
          });
        } catch (error) {
          console.warn("Failed to add county boundary layer", error);
        }
      }

      if (countyCityFeatures?.features?.length) {
        try {
          mapInstance.addGeoJsonLayer({
            id: countyCityLayerId,
            data: countyCityFeatures,
            fillColor: "#38bdf8",
            fillOpacity: 0.1,
            strokeColor: "#0ea5e9",
            strokeWidth: 1.5,
            strokeOpacity: 0.85,
          });
        } catch (error) {
          console.warn("Failed to add county municipality overlay", error);
        }
      }

      if (!countyGeometry && placeGeometry) {
        try {
          mapInstance.addGeoJsonLayer({
            id: placeLayerId,
            data: placeGeometry,
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            strokeColor: "#2563eb",
            strokeWidth: 3,
            strokeOpacity: 0.9,
          });
        } catch (error) {
          console.warn("Failed to add place boundary layer", error);
        }
      }

      if (placeZipFeatures) {
        const features = placeZipFeatures.features.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            status: stableZipStatuses[feature.properties?.zip] || "available",
          },
        }));

      const collection: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      try {
        mapInstance.addGeoJsonLayer({
          id: zctaLayerId,
          data: collection,
          fillColor: "#94a3b8",
          fillOpacity: 0.2,
          strokeColor: "#64748b",
          strokeWidth: 1.5,
          strokeOpacity: 0.6,
        });
      } catch (error) {
        console.warn("Failed to add ZIP overlay", error);
      }
    }

      if (countyCityFeatures?.features?.length && showCountyCityLabels) {
        try {
          map.addSource(countyCityLabelSourceId, {
            type: "geojson",
            data: countyCityFeatures,
          });
          map.addLayer({
            id: countyCityLabelLayerId,
            type: "symbol",
            source: countyCityLabelSourceId,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 13,
              "text-font": ["Open Sans SemiBold", "Arial Unicode MS Bold"],
              "text-anchor": "center",
              "text-offset": [0, 0],
              "text-padding": 8,
            },
            paint: {
              "text-color": "#0f172a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.8,
              "text-opacity": 0.95,
            },
          });
        } catch (error) {
          console.warn("Failed to add municipality labels", error);
        }
      }

      const fitTarget: GeoJSON.Feature | GeoJSON.FeatureCollection | null =
        mapFocusFeatureRef.current ?? countyGeometry ?? placeGeometry ?? null;

      if (fitTarget && shouldFitViewRef.current) {
        const lockActive =
          focusLockRef.current && focusLockRef.current.until > Date.now();
        if (!lockActive) {
          try {
            mapInstance.fitToData(fitTarget, {
              padding: countyGeometry ? 80 : 50,
              maxZoom: countyGeometry ? 9.5 : 12,
            });
            didRefitDraft = true;
          } catch (error) {
            console.warn("Failed to fit map to geometry", error);
          }
        } else if (focusLockRef.current && focusLockRef.current.until <= Date.now()) {
          focusLockRef.current = null;
        }
        mapFitGeometryRef.current = fitTarget;
        if (mapFocusFeatureRef.current) {
          mapFocusFeatureRef.current = null;
        }
        shouldFitViewRef.current = false;
      } else if (fitTarget && mapFitGeometryRef.current !== fitTarget) {
        mapFitGeometryRef.current = fitTarget;
        if (mapFocusFeatureRef.current) {
          mapFocusFeatureRef.current = null;
        }
      } else if (!fitTarget) {
        mapFitGeometryRef.current = null;
      }

      const draftNameLayerId = "tile-studio-drafts-labels";
      const draftNameSourceId = `${draftNameLayerId}-source`;
      const draftZipLayerId = "tile-studio-drafts-zip-labels";
      const draftZipSourceId = `${draftZipLayerId}-source`;
      const draftPopulationLayerId = "tile-studio-drafts-population";
      const draftPopulationSourceId = `${draftPopulationLayerId}-source`;

      const removeLabelLayer = (layerId: string, sourceId: string) => {
        if (!map) return;
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      };

      removeLabelLayer(draftNameLayerId, draftNameSourceId);
      removeLabelLayer(draftZipLayerId, draftZipSourceId);
      removeLabelLayer(draftPopulationLayerId, draftPopulationSourceId);
      removeLabelLayer(countyCityLabelLayerId, countyCityLabelSourceId);

      if (draftTiles.length) {
        const features: GeoJSON.Feature[] = draftTiles
          .filter((tile) => Boolean(tile.geometry))
          .map((tile) => {
            const geometry = tile.geometry as GeoJSON.Feature;
            return {
              type: "Feature",
              geometry: geometry.geometry,
              properties: {
                ...(geometry.properties ?? {}),
                tileId: tile.tileId,
                slug: tile.slug,
                name: tile.name,
                zips: tile.zips.join(", "),
                zipCount: tile.zipCount,
                population: tile.population ?? null,
              },
            } as GeoJSON.Feature;
          });

        if (features.length) {
          const collection: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features,
          };

          try {
            mapInstance.addGeoJsonLayer({
              id: draftLayerId,
              data: collection,
              fillColor: "#2563eb",
              fillOpacity: 0.16,
              strokeColor: "#1d4ed8",
              strokeWidth: 2,
              strokeOpacity: 0.85,
            });
          } catch (error) {
            console.warn("Failed to add draft tile overlay", error);
          }

          if (showTileLabels) {
            try {
              map.addSource(draftNameSourceId, {
                type: "geojson",
                data: collection,
              });
              map.addLayer({
                id: draftNameLayerId,
                type: "symbol",
                source: draftNameSourceId,
                layout: {
                  "text-field": ["get", "name"],
                  "text-size": 14,
                  "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                  "text-anchor": "center",
                  "text-offset": [0, 0],
                },
                paint: {
                  "text-color": "#1e3a8a",
                  "text-halo-color": "#ffffff",
                  "text-halo-width": 2,
                },
              });
            } catch (error) {
              console.warn("Failed to add draft tile labels", error);
            }
          }

          if (showZipLabels) {
            try {
              map.addSource(draftZipSourceId, {
                type: "geojson",
                data: collection,
              });
              map.addLayer({
                id: draftZipLayerId,
                type: "symbol",
                source: draftZipSourceId,
                layout: {
                  "text-field": ["get", "zips"],
                  "text-size": 11,
                  "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                  "text-anchor": "center",
                  "text-offset": [0, 1.4],
                  "text-max-width": 12,
                },
                paint: {
                  "text-color": "#334155",
                  "text-halo-color": "#ffffff",
                  "text-halo-width": 1.5,
                },
              });
            } catch (error) {
              console.warn("Failed to add ZIP labels", error);
            }
          }

          if (showPopulation) {
            try {
              map.addSource(draftPopulationSourceId, {
                type: "geojson",
                data: collection,
              });
              map.addLayer({
                id: draftPopulationLayerId,
                type: "symbol",
                source: draftPopulationSourceId,
                layout: {
                  "text-field": [
                    "concat",
                    ["to-string", ["get", "population"]],
                    " residents",
                  ],
                  "text-size": 11,
                  "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                  "text-anchor": "center",
                  "text-offset": [0, -1.4],
                },
                paint: {
                  "text-color": "#475569",
                  "text-halo-color": "#ffffff",
                  "text-halo-width": 1.5,
                },
              });
            } catch (error) {
              console.warn("Failed to add population labels", error);
            }
          }

          if (selectedDraftTileId) {
            const selectedFeature = features.find(
              (feature) => feature.properties?.tileId === selectedDraftTileId,
            );
            if (selectedFeature) {
              try {
                mapInstance.addGeoJsonLayer({
                  id: draftSelectedLayerId,
                  data: selectedFeature,
                  fillColor: "#0ea5e9",
                  fillOpacity: 0,
                  strokeColor: "#0284c7",
                  strokeWidth: 2,
                  strokeOpacity: 0.75,
                });
                const focusKey = `draft:${selectedDraftTileId}`;
                const lockActive =
                  focusLockRef.current && focusLockRef.current.until > Date.now();
                if (!lockActive && lastMapFocusRef.current !== focusKey) {
                  mapInstance.fitToData(selectedFeature);
                  didRefitDraft = true;
                  focusLockRef.current = { until: Date.now() + 1500 };
                  lastMapFocusRef.current = focusKey;
                } else if (
                  focusLockRef.current &&
                  focusLockRef.current.until <= Date.now()
                ) {
                  focusLockRef.current = null;
                }
              } catch (error) {
                console.warn("Failed to highlight draft tile", error);
              }
            }
          }
        }
      }
    };

    if (map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.once("idle", applyLayers);
    }

    return () => {
      [
        placeLayerId,
        zctaLayerId,
        countyLayerId,
        countyCityLayerId,
        draftLayerId,
        draftSelectedLayerId,
      ].forEach(removeLayer);
      const mapInstance = map;
      if (mapInstance) {
        const cleanupLabel = (layerId: string, sourceId: string) => {
          if (mapInstance.getLayer(layerId)) {
            mapInstance.removeLayer(layerId);
          }
          if (mapInstance.getSource(sourceId)) {
            mapInstance.removeSource(sourceId);
          }
        };
        cleanupLabel("tile-studio-drafts-labels", "tile-studio-drafts-labels-source");
        cleanupLabel("tile-studio-drafts-zip-labels", "tile-studio-drafts-zip-labels-source");
        cleanupLabel(
          "tile-studio-drafts-population",
          "tile-studio-drafts-population-source",
        );
        cleanupLabel(
          "tile-studio-county-city-labels",
          "tile-studio-county-city-labels-source",
        );
        if (!didRefitDraft && draftViewStateRef.current && map) {
          const { center, zoom } = draftViewStateRef.current;
          map.jumpTo({ center, zoom });
          mapViewStateRef.current = { center, zoom };
        }
        draftViewStateRef.current = null;
      } else {
        draftViewStateRef.current = null;
      }
    };
  }, [
    countyGeometry,
    countyCityFeatures,
    placeGeometry,
    placeZipFeatures,
    draftTiles,
    selectedDraftTileId,
    stableZipStatuses,
    showTileLabels,
    showZipLabels,
    showPopulation,
    showCountyCityLabels,
  ]);

  useEffect(() => {
    const mapInstance = (window as any)[`maplibre_${MAP_ID}`];
    const map = mapInstance?.map;

    let didRefitPublished = false;
    const preservePublishedView = !shouldFitViewRef.current;

    if (preservePublishedView && map) {
      if (mapViewStateRef.current) {
        publishedViewStateRef.current = mapViewStateRef.current;
      } else {
        try {
          const currentCenter = map.getCenter();
          publishedViewStateRef.current = {
            center: [currentCenter.lng, currentCenter.lat],
            zoom: map.getZoom(),
          };
        } catch (error) {
          publishedViewStateRef.current = null;
          console.warn("Failed to capture published view before layer update", error);
        }
      }
    } else {
      publishedViewStateRef.current = null;
    }

    const baseLayerId = "tile-studio-published";
    const highlightLayerId = "tile-studio-selected-published";
    const labelLayerId = "tile-studio-published-labels";
    const labelSourceId = `${labelLayerId}-source`;
    const zipLabelLayerId = "tile-studio-published-zip-labels";
    const zipLabelSourceId = `${zipLabelLayerId}-source`;
    const populationLabelLayerId = "tile-studio-published-population";
    const populationLabelSourceId = `${populationLabelLayerId}-source`;

    const removeLayer = (id: string) => {
      if (!mapInstance?.removeLayer) return;
      try {
        mapInstance.removeLayer(id);
      } catch (error) {
        // ignore missing layers
      }
    };

    const removeHighlight = () => {
      removeLayer(highlightLayerId);
    };

    const removeLabels = () => {
      const mapInst = map;
      if (!mapInst) return;
      const cleanup = (layerId: string, sourceId: string) => {
        if (mapInst.getLayer(layerId)) {
          mapInst.removeLayer(layerId);
        }
        if (mapInst.getSource(sourceId)) {
          mapInst.removeSource(sourceId);
        }
      };
      cleanup(labelLayerId, labelSourceId);
      cleanup(zipLabelLayerId, zipLabelSourceId);
      cleanup(populationLabelLayerId, populationLabelSourceId);
    };

    if (!mapInstance || !map) {
      return;
    }

    const statusIds = new Set<string>();
    serviceAreas.forEach((area) => {
      statusIds.add(area.tile.status);
    });

    statusIds.forEach((status) => {
      removeLayer(`${baseLayerId}-${status.toLowerCase()}`);
    });
    removeHighlight();
    removeLabels();

    const featuresByStatus = new Map<string, GeoJSON.Feature[]>();
    serviceAreas.forEach((area) => {
      if (!area.tileGeometry?.geometry) return;
      const status = area.tile.status;
      if (status === "DRAFT") {
        return;
      }
      const feature: GeoJSON.Feature = {
        type: "Feature",
        geometry: area.tileGeometry.geometry as GeoJSON.Geometry,
        properties: {
          slug: area.tile.slug,
          name: area.tile.name,
          status,
          zipCount: area.zipCount,
          customColor: customTileColors[area.tile.slug] ?? null,
        },
      };
      if (!featuresByStatus.has(status)) {
        featuresByStatus.set(status, []);
      }
      featuresByStatus.get(status)!.push(feature);
    });

    featuresByStatus.forEach((features, status) => {
      if (!features.length) return;
      const collection: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      const colors = PUBLISHED_STATUS_COLORS[status] ?? {
        fill: "#94a3b8",
        stroke: "#475569",
      };
      const fillExpression: any = [
        "coalesce",
        ["get", "customColor"],
        colors.fill,
      ];
      const strokeExpression: any = [
        "coalesce",
        ["get", "customColor"],
        colors.stroke,
      ];

      const shouldRenderFill = status === "LIVE";
      const computedFillOpacity = shouldRenderFill ? 0.06 : 0;
      const computedStrokeOpacity = status === "LIVE" ? 0.8 : 0.55;
      const computedStrokeWidth = status === "LIVE" ? 2 : 1.6;

      try {
        mapInstance.addGeoJsonLayer({
          id: `${baseLayerId}-${status.toLowerCase()}`,
          data: collection,
          fillColor: fillExpression,
          fillOpacity: computedFillOpacity,
          strokeColor: strokeExpression,
          strokeWidth: computedStrokeWidth,
          strokeOpacity: computedStrokeOpacity,
        });
      } catch (error) {
        console.warn(`Failed to render published tiles for status ${status}`, error);
      }
    });

    const labelFeatures: GeoJSON.Feature[] = serviceAreas
      .filter((area) => area.tileGeometry?.geometry && area.tile.status !== "DRAFT")
      .map((area) => ({
        type: "Feature",
        geometry: area.tileGeometry!.geometry as GeoJSON.Geometry,
        properties: {
          name: area.tile.name,
          slug: area.tile.slug,
          status: area.tile.status,
          customColor: customTileColors[area.tile.slug] ?? null,
          zips: area.zips.map((entry) => entry.zip).join(", "),
          population:
            area.totalPopulation ??
            area.zips.reduce((sum, entry) => sum + (entry.population ?? 0), 0),
        },
      }));

    if (showTileLabels && labelFeatures.length) {
      try {
        map.addSource(labelSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: labelFeatures,
          },
        });
        map.addLayer({
          id: labelLayerId,
          type: "symbol",
          source: labelSourceId,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 12,
            "text-anchor": "center",
            "text-offset": [0, 0],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
            "symbol-placement": "point",
          },
          paint: {
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      } catch (error) {
        console.warn("Failed to render published tile labels", error);
      }
    }

    if (showZipLabels && labelFeatures.length) {
      try {
        map.addSource(zipLabelSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: labelFeatures,
          },
        });
        map.addLayer({
          id: zipLabelLayerId,
          type: "symbol",
          source: zipLabelSourceId,
          layout: {
            "text-field": ["get", "zips"],
            "text-size": 10,
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-anchor": "center",
            "text-offset": [0, 1.2],
            "text-max-width": 12,
          },
          paint: {
            "text-color": "#334155",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.4,
          },
        });
      } catch (error) {
        console.warn("Failed to render published ZIP labels", error);
      }
    }

    if (showPopulation && labelFeatures.length) {
      try {
        map.addSource(populationLabelSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: labelFeatures,
          },
        });
        map.addLayer({
          id: populationLabelLayerId,
          type: "symbol",
          source: populationLabelSourceId,
          layout: {
            "text-field": [
              "concat",
              ["to-string", ["get", "population"]],
              " residents",
            ],
            "text-size": 10,
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-anchor": "center",
            "text-offset": [0, -1.2],
          },
          paint: {
            "text-color": "#475569",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.4,
          },
        });
      } catch (error) {
        console.warn("Failed to render published population labels", error);
      }
    }

    const selectedPublished = selectedTileSlug
      ? serviceAreas.find((area) => area.tile.slug === selectedTileSlug)
      : null;

    if (selectedPublished?.tileGeometry?.geometry) {
      const selectedCustomColor = customTileColors[selectedPublished.tile.slug] ?? "#0ea5e9";
      try {
        mapInstance.addGeoJsonLayer({
          id: highlightLayerId,
          data: {
            type: "Feature",
            geometry: selectedPublished.tileGeometry.geometry as GeoJSON.Geometry,
            properties: {
              slug: selectedPublished.tile.slug,
              name: selectedPublished.tile.name,
              customColor: selectedCustomColor,
            },
          },
          fillColor: selectedCustomColor,
          fillOpacity: 0,
          strokeColor: selectedCustomColor,
          strokeWidth: 3,
          strokeOpacity: 0.9,
        });
        const focusKey = `tile:${selectedPublished.tile.slug}`;
        const lockActive =
          focusLockRef.current && focusLockRef.current.until > Date.now();
        if (!lockActive && lastMapFocusRef.current !== focusKey) {
          mapInstance.fitToData({
            type: "Feature",
            geometry: selectedPublished.tileGeometry.geometry as GeoJSON.Geometry,
            properties: {},
          });
          didRefitPublished = true;
          focusLockRef.current = { until: Date.now() + 1500 };
          lastMapFocusRef.current = focusKey;
        } else if (focusLockRef.current && focusLockRef.current.until <= Date.now()) {
          focusLockRef.current = null;
        }
      } catch (error) {
        console.warn("Failed to highlight selected published tile", error);
      }
    }

    return () => {
      statusIds.forEach((status) => {
        removeLayer(`${baseLayerId}-${status.toLowerCase()}`);
      });
      removeHighlight();
      removeLabels();
      if (!didRefitPublished && publishedViewStateRef.current && map) {
        const { center, zoom } = publishedViewStateRef.current;
        map.jumpTo({ center, zoom });
        mapViewStateRef.current = { center, zoom };
      }
      publishedViewStateRef.current = null;
    };
  }, [
    customTileColors,
    serviceAreas,
    selectedTileSlug,
    showTileLabels,
    showZipLabels,
    showPopulation,
  ]);
  const mapStylePreference = useMemo(() => {
    const ensureStyle = (
      style: string | StyleSpecification | null,
    ): string | StyleSpecification => {
      if (style) return style;
      return OSM_FALLBACK_STYLE;
    };

    const lightStyle = ensureStyle(DEFAULT_LIGHT_MAP_STYLE);
    const darkStyle = ensureStyle(
      DEFAULT_DARK_MAP_STYLE === DEFAULT_LIGHT_MAP_STYLE
        ? DEFAULT_LIGHT_MAP_STYLE
        : DEFAULT_DARK_MAP_STYLE,
    );

    if (mapStyleMode === "satellite") {
      return { style: SATELLITE_STYLE, key: "satellite" };
    }

    if (mapStyleMode === "light") {
      return { style: lightStyle, key: "light" };
    }

    if (mapStyleMode === "dark") {
      return { style: darkStyle, key: "dark" };
    }

    const isDark = resolvedTheme === "dark";
    return {
      style: isDark ? darkStyle : lightStyle,
      key: isDark ? "auto-dark" : "auto-light",
    };
  }, [mapStyleMode, resolvedTheme]);

  // Load location options for autocomplete
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const autocompleteCacheRef = useRef<Map<string, LocationOption[]>>(new Map());
  const lastAutocompleteQueryRef = useRef<string>("");

  const performAutocompleteSearch = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      lastAutocompleteQueryRef.current = trimmed;

      if (trimmed.length < 2) {
        if (autocompleteAbortRef.current) {
          autocompleteAbortRef.current.abort();
          autocompleteAbortRef.current = null;
        }
        setSuggestionsLoading(false);
        setLocationOptions([]);
        return;
      }

      const cacheKey = `${searchMode}:${stateFilter}:${trimmed}`.toLowerCase();
      if (autocompleteCacheRef.current.has(cacheKey)) {
        const cached = autocompleteCacheRef.current.get(cacheKey) ?? [];
        if (lastAutocompleteQueryRef.current === trimmed) {
          setLocationOptions(cached);
          setSuggestionsLoading(false);
        }
        return;
      }

      try {
        if (autocompleteAbortRef.current) {
          autocompleteAbortRef.current.abort();
        }
        const controller = new AbortController();
        autocompleteAbortRef.current = controller;

        if (searchMode === "county") {
          const params = new URLSearchParams({ query: trimmed, limit: "20" });
          if (stateFilter !== "ALL") {
            params.set("state", stateFilter);
          }
          const response = await fetch(`/api/admin/geo/search-counties?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            if (lastAutocompleteQueryRef.current === trimmed) {
              setLocationOptions([]);
            }
            return;
          }
          const payload = await response.json();
          if (lastAutocompleteQueryRef.current !== trimmed) return;
          const options: LocationOption[] = Array.isArray(payload?.results)
            ? payload.results.map((county: CountySuggestion) => ({
                id: `county-${county.countyId}`,
                label: `${county.name} County, ${county.state}`,
                city: county.name,
                state: county.state,
                type: "county",
                zipCount: 0, // ZIP count removed for performance
              }))
            : [];
          setLocationOptions(options);
          autocompleteCacheRef.current.set(cacheKey, options);
        } else {
          const params = new URLSearchParams({ q: trimmed, limit: "20" });
          if (stateFilter !== "ALL") {
            params.set("state", stateFilter);
          }
          const response = await fetch(`/api/geo/autocomplete?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            if (lastAutocompleteQueryRef.current === trimmed) {
              setLocationOptions([]);
            }
            return;
          }
          const data = await response.json();
          if (lastAutocompleteQueryRef.current === trimmed) {
            setLocationOptions(data.options ?? []);
            autocompleteCacheRef.current.set(cacheKey, data.options ?? []);
          }
        }
      } catch (error) {
        if ((error as any)?.name === "AbortError") {
          return;
        }
        console.warn("Failed to search markets:", error);
        if (lastAutocompleteQueryRef.current === trimmed) {
          setLocationOptions([]);
        }
      } finally {
        if (lastAutocompleteQueryRef.current === trimmed) {
          setSuggestionsLoading(false);
        }
        autocompleteAbortRef.current = null;
      }
    },
    [searchMode, stateFilter],
  );

  // Handle location search with debounce
  const handleLocationSearch = useCallback(
    (query: string) => {
      setLocationQuery(query);
      setShowLocationOptions(true);

      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
      }

      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setSuggestionsLoading(false);
        lastAutocompleteQueryRef.current = trimmed;
        void performAutocompleteSearch(query);
        return;
      }

      setSuggestionsLoading(true);
      autocompleteTimerRef.current = setTimeout(() => {
        void performAutocompleteSearch(query);
      }, 250);
    },
    [performAutocompleteSearch],
  );

  useEffect(() => {
    return () => {
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
      }
      if (autocompleteAbortRef.current) {
        autocompleteAbortRef.current.abort();
        autocompleteAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const trimmed = locationQuery.trim();
    if (trimmed.length < 2) {
      setLocationOptions([]);
      setSuggestionsLoading(false);
      return;
    }

    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
    }
    setSuggestionsLoading(true);
    autocompleteTimerRef.current = setTimeout(() => {
      void performAutocompleteSearch(locationQuery);
    }, 100);
  }, [locationQuery, performAutocompleteSearch, searchMode, stateFilter]);

  // Handle location selection
  const handleLocationSelect = (option: LocationOption) => {
    setSelectedLocation(option);
    setLocationQuery(option.label);
    setShowLocationOptions(false);
    if (option.state) {
      setStateFilter(option.state);
    }
    setGenerationMode("cluster");
    setTileCount(4);
    mapFocusFeatureRef.current = null;
    void searchZips(option);
  };

  const SERVICE_AREAS_CACHE_TTL_MS = 60_000;

  const loadServiceAreas = useCallback(
    async (forceRefresh = false) => {
      const cached = serviceAreaCacheRef.current;
      const now = Date.now();

      if (!forceRefresh && cached && now - cached.timestamp < SERVICE_AREAS_CACHE_TTL_MS) {
        setServiceAreas(cached.areas);
        setStatusCounts(cached.statusCounts);
        setConflictSummary(cached.conflictSummary);
        syncZipStateFromAreas(cached.areas);
        setServiceAreasLoading(false);
        return cached.areas;
      }

      setServiceAreasLoading(true);
      try {
        const response = await fetch("/api/admin/service-areas");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || response.statusText || "Failed to load service areas",
          );
        }

        const areas: ServiceAreaSummary[] = data.serviceAreas ?? [];
        const counts: Record<string, number> = data.statusCounts ?? {};
        const conflict = data.conflictSummary ?? {};

        setStatusCounts(counts);
        const normalizedConflict = {
          tilesWithConflicts: Number(conflict.tilesWithConflicts ?? 0),
          conflictZipTotal: Number(conflict.conflictZipTotal ?? 0),
          conflictZips: Array.isArray(conflict.conflictZips)
            ? conflict.conflictZips.map((zip: unknown) => String(zip).padStart(5, "0"))
            : [],
        };
        setConflictSummary(normalizedConflict);

        const conflictTotal = normalizedConflict.conflictZipTotal;
        if (conflictTotal > 0 && conflictToastTotalRef.current !== conflictTotal) {
          toast.warning(
            `There are ${conflictTotal} ZIP${conflictTotal === 1 ? "" : "s"} assigned to multiple tiles. Review and resolve conflicts.`,
          );
          conflictToastTotalRef.current = conflictTotal;
        }
        if (conflictTotal === 0) {
          conflictToastTotalRef.current = 0;
        }

        console.log("[TileStudio] Loaded service areas:", areas.length);
        const tilesWithGeometry = areas.filter((a) => a.tileGeometry && a.tileGeometry.geometry);
        const tilesWithoutGeometry = areas.filter((a) => !a.tileGeometry || !a.tileGeometry.geometry);
        console.log("[TileStudio] Tiles WITH geometry:", tilesWithGeometry.map((a) => a.tile.name));
        console.log("[TileStudio] Tiles WITHOUT geometry:", tilesWithoutGeometry.map((a) => a.tile.name));

        setServiceAreas(areas);

        const allowedSlugs = new Set(areas.map((area) => area.tile.slug));
        setCustomTileColors((prev) => {
          const next: Record<string, string> = {};
          Object.entries(prev).forEach(([slug, color]) => {
            if (allowedSlugs.has(slug)) {
              next[slug] = color;
            }
          });
          return next;
        });
        setSelectedTileSlugs((prev) => prev.filter((slug) => allowedSlugs.has(slug)));
        setSelectedTileSlug((prev) => (prev && allowedSlugs.has(prev) ? prev : areas[0]?.tile.slug ?? null));

        syncZipStateFromAreas(areas);

        serviceAreaCacheRef.current = {
          timestamp: now,
          areas,
          statusCounts: counts,
          conflictSummary: normalizedConflict,
        };

        return areas;
      } catch (error: any) {
        console.warn("Failed to load service areas", error);
        toast.error(error?.message ?? "Failed to load service areas");
        return [] as ServiceAreaSummary[];
      } finally {
        setServiceAreasLoading(false);
      }
    },
    [serviceAreaCacheRef, syncZipStateFromAreas],
  );

  const fetchPlaceDetails = useCallback(
    async (city: string, state: string): Promise<PlaceSearchResult | null> => {
      setPlaceDetailsLoading(true);
      try {
        const params = new URLSearchParams({
          query: `${city}, ${state}`,
          state,
          limit: "1",
        });

        const response = await fetch(`/api/admin/geo/search?${params.toString()}`, {
          credentials: "include",
        });

        const body = await response.json();

        if (!response.ok || !body?.results) {
          const message = body?.error || body?.message || "Failed to load place details";
          throw new Error(message);
        }

        const place: PlaceSearchResult | null = Array.isArray(body.results)
          ? body.results[0] ?? null
          : null;

        setPlaceDetails(place);
        return place;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load place details";
        console.error("fetchPlaceDetails error", error);
        toast.error(message);
        setPlaceDetails(null);
        return null;
      } finally {
        setPlaceDetailsLoading(false);
      }
    },
    [],
  );

  const [draftPage, setDraftPage] = useState(1);
  const PAGE_SIZE = 25;

  const fetchDraftTiles = useCallback(
    async (page = 1, reset = false) => {
      setDraftTilesLoading(true);
      try {
        const response = await fetchDraftTilesApi({ page, limit: PAGE_SIZE });
        setDraftTotalCount(response.total);

        setDraftTiles((prev) => {
          if (reset || page === 1) {
            return response.tiles;
          }

          const next = [...prev];
          response.tiles.forEach((tile) => {
            const idx = next.findIndex((existing) => existing.tileId === tile.tileId);
            if (idx === -1) {
              next.push(tile);
            } else {
              next[idx] = tile;
            }
          });
          return next;
        });

        if (reset) {
          draftPagesLoadedRef.current = new Set([page]);
        } else {
          draftPagesLoadedRef.current.add(page);
        }

        if (reset) {
          setDraftPage(page);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load draft tiles";
        console.error("fetchDraftTiles error", error);
        toast.error(message);
        if (reset) {
          draftPagesLoadedRef.current = new Set();
        } else {
          draftPagesLoadedRef.current.delete(page);
        }
        if (reset) {
          setDraftTiles([]);
          setDraftTotalCount(0);
        }
      } finally {
        setDraftTilesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchDraftTiles(1, true);
  }, [status, fetchDraftTiles]);

  useEffect(() => {
    setShowAllConflicts(false);
  }, [conflictSummary.conflictZipTotal]);

  useEffect(() => {
    if (draftPagesLoadedRef.current.has(draftPage)) return;
    fetchDraftTiles(draftPage);
  }, [draftPage, fetchDraftTiles]);

  useEffect(() => {
    const shouldPrefetchAll = showAllDrafts || draftFilter.trim().length > 0;
    if (!shouldPrefetchAll) return;
    if (draftTotalCount <= draftTiles.length) return;

    const totalPages = Math.max(1, Math.ceil(draftTotalCount / PAGE_SIZE));
    const missingPages: number[] = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (!draftPagesLoadedRef.current.has(page)) {
        missingPages.push(page);
      }
    }
    if (missingPages.length === 0) return;

    let cancelled = false;
    const loadSequentially = async () => {
      for (const page of missingPages) {
        if (cancelled) return;
        await fetchDraftTiles(page);
      }
    };

    void loadSequentially();

    return () => {
      cancelled = true;
    };
  }, [showAllDrafts, draftFilter, draftTotalCount, draftTiles.length, fetchDraftTiles]);

  const canGenerateTiles = selectedLocation?.type === "city";

  const availableZipCount = useMemo(() => {
    if (results?.zips?.length) {
      return results.zips.length;
    }
    if (placeZipFeatures?.features?.length) {
      return placeZipFeatures.features.length;
    }
    if (selectedLocation?.zipCount) {
      return selectedLocation.zipCount;
    }
    return 0;
  }, [placeZipFeatures, results, selectedLocation]);

  const plannedGenerationCount = generationMode === "perZip" ? availableZipCount : tileCount;

  const handleGenerateDraftTiles = useCallback(async () => {
    console.log("[TileStudio] handleGenerateDraftTiles CALLED");
    console.log("[TileStudio] selectedLocation:", selectedLocation);
    console.log("[TileStudio] placeDetails:", placeDetails);
    console.log("[TileStudio] generationMode:", generationMode);
    console.log("[TileStudio] availableZipCount:", availableZipCount);
    
    if (!selectedLocation) {
      console.log("[TileStudio] ABORT: No selected location");
      toast.error("Select a location before generating tiles");
      return;
    }

    if (generationMode === "perZip" && availableZipCount === 0) {
      console.log("[TileStudio] ABORT: No ZIPs for perZip mode");
      toast.error("Search must return ZIP codes before generating one tile per ZIP");
      return;
    }

    let activePlace = placeDetails;
    if (!activePlace) {
      console.log("[TileStudio] No placeDetails cached, fetching...");
      activePlace = await fetchPlaceDetails(
        selectedLocation.city,
        selectedLocation.state,
      );
      console.log("[TileStudio] Fetched activePlace:", activePlace);
      if (!activePlace) {
        console.log("[TileStudio] ABORT: fetchPlaceDetails returned null");
        return;
      }
    }

    if (!activePlace.placeId) {
      console.log("[TileStudio] ABORT: No placeId");
      toast.error("Place metadata is missing an ID for tile generation");
      return;
    }
    
    console.log("[TileStudio] Proceeding with tile generation for placeId:", activePlace.placeId);

    const expectedTileCount = generationMode === "perZip"
      ? Math.max(availableZipCount, 1)
      : tileCount;

    const loadingId = toast.loading("Generating draft tiles…");
    setIsGeneratingTiles(true);
    
    // Lock map temporarily during generation
    lockMapFocus(2000);
    
    try {
      const generation = await generateDraftTiles({
        placeId: activePlace.placeId,
        tileCount: generationMode === "perZip" ? 1 : tileCount,
        generationMode,
        city: selectedLocation.city,
        state: selectedLocation.state,
      });

      // After polling completes, generation.data could be:
      // - TileGenerationResult (from async job)
      // - { orgId, generation, drafts } (from synchronous fallback)
      const data = generation.data;
      const result = ('generation' in data ? data.generation : data) as {
        placeId: string;
        placeName: string;
        placeState: string | null;
        placeAreaSqMeters: number;
        placeGeometry: GeoJSON.Feature | null;
        tileCount: number;
        tiles: { tileId: string; slug: string; name: string }[];
      };
      
      if (result?.placeGeometry) {
        setPlaceGeometry(result.placeGeometry as GeoJSON.Feature);
      }

      const generatedCount = result?.tileCount ?? expectedTileCount;
      const placeName = result?.placeName ?? selectedLocation.city;

      toast.success(
        `Generated ${generatedCount} tile${generatedCount === 1 ? "" : "s"} for ${placeName}.`,
        { id: loadingId },
      );

      // Fetch the full draft tiles from the database
      await fetchDraftTiles(1, true);
      
      // Zoom to the first generated tile after fetching
      if (result?.tiles && result.tiles.length > 0) {
        // Wait for draft tiles to load, then select the first one
        setTimeout(() => {
          // The fetchDraftTiles will update draftTiles state
          // We'll select the first tile in the next render
          shouldFitViewRef.current = true;
          mapFocusFeatureRef.current = null; // Will use draft tiles geometry
        }, 500);
      }
      
      await loadServiceAreas(true);
      
      // Scroll to map to show the generated tiles
      scrollToMap();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tile generation failed";
      toast.error(message, { id: loadingId });
    } finally {
      setIsGeneratingTiles(false);
    }
  }, [
    availableZipCount,
    fetchPlaceDetails,
    fetchDraftTiles,
    generationMode,
    lockMapFocus,
    loadServiceAreas,
    placeDetails,
    selectedLocation,
    tileCount,
  ]);

  const handleDeleteDraftTile = useCallback(
    async (tileId: string) => {
      setDraftActionPendingId(tileId);
      setDraftActionPendingType("delete");
    try {
      await deleteDraftTileApi(tileId);

      toast.success("Draft tile deleted");
    setDraftTiles((prev: DraftTile[]) => prev.filter((tile) => tile.tileId !== tileId));
        if (selectedDraftTileId === tileId) {
          setSelectedDraftTileId(null);
        }
        await loadServiceAreas(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete tile";
        toast.error(message);
      } finally {
        setDraftActionPendingId(null);
        setDraftActionPendingType(null);
      }
    },
    [loadServiceAreas, selectedDraftTileId],
  );

  const handlePublishDraftTile = useCallback(
    async (tileId: string) => {
      setDraftActionPendingId(tileId);
      setDraftActionPendingType("publish");
    try {
      const summary = await publishDraftTileApi(tileId, publishStatus);

      toast.success("Tile published");
      await fetchDraftTiles(1, true);
      await loadServiceAreas(true);
      if (summary?.slug) {
        setSelectedTileSlug(summary.slug);
      }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to publish tile";
        toast.error(message);
      } finally {
        setDraftActionPendingId(null);
        setDraftActionPendingType(null);
      }
    },
    [fetchDraftTiles, loadServiceAreas, publishStatus],
  );

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

  useEffect(() => {
    loadServiceAreas();
  }, [loadServiceAreas]);

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
    const persistedColors = loadCustomTileColors();

    console.log("Loading persisted data on mount:", {
      zipStatusesCount: Object.keys(persistedZipStatuses).length,
      searchedCitiesCount: persistedSearchedCities.length,
      searchedCities: persistedSearchedCities.map(
        (c) => `${c.city}, ${c.state}`,
      ),
    });

    setZipStatuses(persistedZipStatuses);
    setSearchedCities(persistedSearchedCities);
    setActiveSavedSearchId(persistedSearchedCities[0]?.id ?? null);
    setCustomTileColors(persistedColors);

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
    loadServiceAreas();

    // Set hasSearched to true so maps are visible on page load if we have persisted cities
    if (persistedSearchedCities.length > 0) {
      setHasSearched(true);
    }
  }, [businessId, loadServiceAreas]);

  // Save ZIP statuses to localStorage whenever they change
  useEffect(() => {
    saveZipStatuses(zipStatuses, businessId);
  }, [zipStatuses, businessId]);

  useEffect(() => {
    persistCustomTileColors(customTileColors);
  }, [customTileColors]);

  const serviceAreaData = useMemo<ServiceAreaData | null>(() => {
    if (!serviceAreas.length) {
      return null;
    }

    const features = serviceAreas
      .map((area) => area.tileGeometry)
      .filter(Boolean) as GeoJSON.Feature[];

    return {
      businessId,
      groups: serviceAreas.map((area) => ({
        city: area.tile.name,
        state: "",
        zips: area.zips.map((entry) => entry.zip),
      })),
      combined: {
        type: "FeatureCollection",
        features,
      },
      stats: {
        totalZips: serviceAreas.reduce((sum, area) => sum + area.zipCount, 0),
        totalGroups: serviceAreas.length,
        totalFeatures: features.length,
      },
    };
  }, [businessId, serviceAreas]);

  const searchZips = async (locationOverride?: LocationOption) => {
    const location = locationOverride ?? selectedLocation;

    if (!location) {
      setError("Please select a location");
      return;
    }

    setSearching(true);
    setError(null);
    setResults(null);
    setHasSearched(false);
    setCountyGeometry(null);
    setCountyCityFeatures(null);

    try {
      const searchType = location.type === "county" ? "county" : "city";
      console.log(
        `Searching for ZIP codes in: ${location.city}, ${location.state} (${searchType})`,
      );
      const response = await fetch("/api/geo/zip-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: location.city.trim(),
          state: location.state.trim(),
          searchType,
        }),
      });

      console.log("[TileStudio] ZIP search response status:", response.status);

      if (response.ok) {
        const data: ZIPSearchResult = await response.json();
        setResults({
          ...data,
          zips: data.zips || [],
          zipsWithoutGeometry: data.zipsWithoutGeometry || [],
        });
        setPlaceGeometry((data.map?.place as GeoJSON.Feature) ?? null);
        setPlaceZipFeatures((data.map?.includedZctas as GeoJSON.FeatureCollection) ?? null);
        setCountyGeometry((data.map?.county as GeoJSON.Feature) ?? null);
        const countyCitiesCollection =
          (data.map?.countyCities as GeoJSON.FeatureCollection) ?? null;
        setCountyCityFeatures(countyCitiesCollection);
        if (countyCitiesCollection?.features?.length) {
          setShowCountyCityLabels(true);
        }
        mapFocusFeatureRef.current =
          (data.map?.county as GeoJSON.Feature) ?? (data.map?.place as GeoJSON.Feature) ?? null;
        shouldFitViewRef.current = true;
        mapFitGeometryRef.current = null;
        console.log(`Search successful: Found ${data.zips.length} ZIP codes`);
        setHasSearched(true);
        setSelectedDraftTileId(null);
        setSelectedTileSlug(null);
        scrollToMap();

        const newSearchedCity: Omit<SearchedCity, "id"> = {
          city: location.city,
          state: location.state,
          searchType,
          searchResult: data,
        };

        let persistedId = "";
        setSearchedCities((prev) => {
          const next = [...prev];
          const existingIndex = next.findIndex(
            (city) =>
              city.searchType === newSearchedCity.searchType &&
              city.city.toLowerCase() === newSearchedCity.city.toLowerCase() &&
              city.state.toLowerCase() === newSearchedCity.state.toLowerCase(),
          );

          if (existingIndex >= 0) {
            persistedId = next[existingIndex].id;
            next.splice(existingIndex, 1);
          }
          if (!persistedId) {
            persistedId = `search-${Date.now()}`;
          }
          next.unshift({ ...newSearchedCity, id: persistedId });
          saveSearchedCities(next, businessId);
          return next;
        });

        if (persistedId) {
          setActiveSavedSearchId(persistedId);
        }

        setZipStatuses((prev) => {
          const next = { ...prev };
          data.zips.forEach((zipCode) => {
            if (!next[zipCode] || next[zipCode] === "error") {
              next[zipCode] = "available";
            }
          });
          return next;
        });

        if (searchType === "city") {
          const placeData = await fetchPlaceDetails(location.city, location.state);
          console.log("[TileStudio] Place details loaded:", placeData?.placeId);
        }
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

  const addZipToZone = async (zipCode: string, tileSlug?: string) => {
    let targetSlug = tileSlug ?? selectedTileSlug;
    if (!targetSlug && serviceAreas.length > 0) {
      targetSlug = serviceAreas[0].tile.slug;
      setSelectedTileSlug(targetSlug);
    }
    if (!targetSlug) {
      setError("Select a service tile before adding ZIPs");
      return;
    }

    setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "adding" }));

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileSlug: targetSlug, addZips: [zipCode] }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unknown error");
      }

      const summary: ServiceAreaSummary | null = payload?.serviceArea ?? null;
      const reassignedZips: { zip: string; previousTileSlug: string }[] = Array.isArray(
        payload?.reassignedZips,
      )
        ? payload.reassignedZips
        : [];

      if (summary) {
        targetSlug = summary.tile.slug;
        const isLive = summary.tile.status === "LIVE";

        setZipMetadata((prev: ZipMetadataMap) => ({
          ...prev,
          [zipCode]: {
            slug: summary.tile.slug,
            status: summary.tile.status,
            activationEligible: isLive,
            advisories: prev[zipCode]?.advisories ?? [],
            eligible: isLive || (prev[zipCode]?.eligible ?? false),
            estimatedDelivery: prev[zipCode]?.estimatedDelivery ?? null,
            zoneName: summary.tile.name,
          },
        }));
      }

      setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "added" }));
      toast.success(`ZIP ${zipCode} assigned to ${summary?.tile.name ?? targetSlug}`);
      setError(null);

      if (reassignedZips.length) {
        const previousList = reassignedZips
          .slice(0, 5)
          .map((entry) => `${entry.zip} from ${entry.previousTileSlug}`)
          .join(", ");
        toast.warning(
          `Reassigned ${reassignedZips.length} ZIP${reassignedZips.length === 1 ? "" : "s"}: ${previousList}${
            reassignedZips.length > 5 ? "…" : ""
          }`,
        );
      }

      await loadServiceAreas(true);
    } catch (err: any) {
      console.error("Failed to add ZIP", err);
      setError(`Failed to add ZIP ${zipCode}: ${err?.message ?? err}`);
    setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "error" }));
    }
  };

  const removeZipFromZone = async (zipCode: string, tileSlug?: string) => {
    let targetSlug = tileSlug ?? zipMetadata[zipCode]?.slug ?? selectedTileSlug;
    if (!targetSlug && serviceAreas.length > 0) {
      targetSlug = serviceAreas[0].tile.slug;
      setSelectedTileSlug(targetSlug);
    }
    if (!targetSlug) {
      setError("Unable to determine which tile owns this ZIP");
      return;
    }

    setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "removing" }));

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileSlug: targetSlug, removeZips: [zipCode] }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unknown error");
      }

      setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "available" }));
      setZipMetadata((prev: ZipMetadataMap) => {
        const next: ZipMetadataMap = { ...prev };
        delete next[zipCode];
        return next;
      });
      setError(null);
      toast.success(`ZIP ${zipCode} removed from ${targetSlug}`);
      await loadServiceAreas(true);
    } catch (err: any) {
      console.error("Failed to remove ZIP", err);
      setError(`Failed to remove ZIP ${zipCode}: ${err?.message ?? err}`);
      setZipStatuses((prev: ZipStatus) => ({ ...prev, [zipCode]: "error" }));
    }
  };

  const addAllZipsToZone = async (zipCodes: string[], tileSlug?: string) => {
    let targetSlug = tileSlug ?? selectedTileSlug;
    if (!targetSlug && serviceAreas.length > 0) {
      targetSlug = serviceAreas[0].tile.slug;
      setSelectedTileSlug(targetSlug);
    }
    if (!targetSlug) {
      setError("Select a service tile before adding ZIPs");
      return;
    }

    const newStatuses: ZipStatus = { ...zipStatuses };
    zipCodes.forEach((zip) => {
      newStatuses[zip] = "adding";
    });
    setZipStatuses(newStatuses);

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileSlug: targetSlug, addZips: zipCodes }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unknown error");
      }

      const summary: ServiceAreaSummary | null = payload?.serviceArea ?? null;
      const reassignedZips: { zip: string; previousTileSlug: string }[] = Array.isArray(
        payload?.reassignedZips,
      )
        ? payload.reassignedZips
        : [];

      const successStatuses: ZipStatus = { ...zipStatuses };
      zipCodes.forEach((zip) => {
        successStatuses[zip] = "added";
      });
      setZipStatuses(successStatuses);

      if (summary) {
        const isLive = summary.tile.status === "LIVE";
        setZipMetadata((prev: ZipMetadataMap) => {
          const next: ZipMetadataMap = { ...prev };
          zipCodes.forEach((zip) => {
            next[zip] = {
              slug: summary.tile.slug,
              status: summary.tile.status,
              activationEligible: isLive,
              advisories: prev[zip]?.advisories ?? [],
            eligible: isLive || Boolean(prev[zip]?.eligible),
              estimatedDelivery: prev[zip]?.estimatedDelivery ?? null,
              zoneName: summary.tile.name,
            };
          });
          return next;
        });
      }

      toast.success(
        `Added ${zipCodes.length} ZIP${zipCodes.length === 1 ? "" : "s"} to ${summary?.tile.name ?? targetSlug}`,
      );
      setError(null);
      if (reassignedZips.length) {
        const previousList = reassignedZips
          .slice(0, 5)
          .map((entry) => `${entry.zip} from ${entry.previousTileSlug}`)
          .join(", ");
        toast.warning(
          `Reassigned ${reassignedZips.length} ZIP${reassignedZips.length === 1 ? "" : "s"}: ${previousList}${
            reassignedZips.length > 5 ? "…" : ""
          }`,
        );
      }

      await loadServiceAreas(true);
    } catch (err: any) {
      console.error("Failed to add ZIPs", err);
      const errorStatuses: ZipStatus = { ...zipStatuses };
      zipCodes.forEach((zip) => {
        errorStatuses[zip] = "error";
      });
      setZipStatuses(errorStatuses);
      setError(`Failed to add selected ZIPs: ${err?.message ?? err}`);
    }
  };

  const handleClearAll = useCallback(async (targetSlugParam?: string) => {
    let targetSlug = targetSlugParam ?? selectedTileSlug;
    if (!targetSlug && serviceAreas.length > 0) {
      targetSlug = serviceAreas[0].tile.slug;
      setSelectedTileSlug(targetSlug);
    }
    if (!targetSlug) {
      setError("Select a service tile before clearing ZIPs");
      return;
    }

    const area = serviceAreas.find((item) => item.tile.slug === targetSlug);
    const zipList = area?.zips.map((entry) => entry.zip) ?? [];
    if (zipList.length === 0) {
      return;
    }

    setZipStatuses((prev: ZipStatus) => {
      const next: ZipStatus = { ...prev };
      zipList.forEach((zip) => {
        next[zip] = "removing";
      });
      return next;
    });

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileSlug: targetSlug, removeZips: zipList }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unknown error");
      }

      setZipMetadata((prev: ZipMetadataMap) => {
        const next: ZipMetadataMap = { ...prev };
        zipList.forEach((zip) => {
          delete next[zip];
        });
        return next;
      });

      toast.success(
        `Removed ${zipList.length} ZIP${zipList.length === 1 ? "" : "s"} from ${targetSlug}`,
      );
      setError(null);
      await loadServiceAreas(true);
    } catch (err: any) {
      console.error("Failed to clear ZIPs", err);
      setError(`Failed to clear ZIPs: ${err?.message ?? err}`);
      setZipStatuses((prev: ZipStatus) => {
        const next: ZipStatus = { ...prev };
        zipList.forEach((zip) => {
          next[zip] = "error";
        });
        return next;
      });
    }
  }, [loadServiceAreas, selectedTileSlug, serviceAreas]);

  const clearFailedZips = () => {
    const clearedStatuses: ZipStatus = {};
    Object.entries(zipStatuses).forEach(([zip, status]) => {
      if (status === "added") {
        clearedStatuses[zip] = status;
      }
    });
    setZipStatuses(clearedStatuses);
    saveZipStatuses(clearedStatuses, businessId);
  };

  const toggleTileSelection = useCallback((slug: string) => {
    setSelectedTileSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((item) => item !== slug);
      }
      return [...prev, slug];
    });
  }, []);

  const clearTileSelection = useCallback(() => {
    setSelectedTileSlugs([]);
  }, []);

  const applyColorToTiles = useCallback((slugs: string[], color?: string) => {
    if (!slugs.length) return;
    setCustomTileColors((prev) => {
      const next = { ...prev };
      slugs.forEach((slug) => {
        if (color && color.trim().length > 0) {
          next[slug] = color;
        } else {
          delete next[slug];
        }
      });
      return next;
    });
  }, []);

  const handleAssignColorToSelection = useCallback(
    (color: string, explicitSlugs?: string[]) => {
      const targets = explicitSlugs && explicitSlugs.length
        ? explicitSlugs
        : selectedTileSlugs.length
          ? selectedTileSlugs
          : selectedTileSlug
            ? [selectedTileSlug]
            : [];
      if (!targets.length) {
        toast.error("Select at least one tile to color");
        return;
      }
      applyColorToTiles(targets, color);
      toast.success(`Applied color to ${targets.length} tile${targets.length === 1 ? "" : "s"}`);
    },
    [applyColorToTiles, selectedTileSlug, selectedTileSlugs],
  );

  const handleClearColorForSelection = useCallback(
    (explicitSlugs?: string[]) => {
      const targets = explicitSlugs && explicitSlugs.length
        ? explicitSlugs
        : selectedTileSlugs.length
          ? selectedTileSlugs
          : selectedTileSlug
            ? [selectedTileSlug]
            : [];
      if (!targets.length) {
        toast.error("Select at least one tile to reset");
        return;
      }
      applyColorToTiles(targets, undefined);
      toast.success(`Cleared color for ${targets.length} tile${targets.length === 1 ? "" : "s"}`);
    },
    [applyColorToTiles, selectedTileSlug, selectedTileSlugs],
  );

  const handleColorInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setColorPickerValue(value);
      if (selectedTileSlug) {
        handleAssignColorToSelection(value, [selectedTileSlug]);
      }
    },
    [handleAssignColorToSelection, selectedTileSlug],
  );

  const handleTileCountChange = useCallback(
    (value: number) => {
      lockMapFocus(2200);
      setTileCount(value);
    },
    [lockMapFocus],
  );

  const handleGenerationModeChange = useCallback(
    (mode: "cluster" | "perZip") => {
      lockMapFocus(2200);
      setGenerationMode(mode);
    },
    [lockMapFocus],
  );

  const handleDeleteServiceTile = useCallback(
    async (slug: string) => {
      if (!slug) return;
      setDeleteTilePendingSlug(slug);
      try {
        await deleteServiceTile(slug);
        toast.success(`Deleted ${slug}`);
        setSelectedTileSlugs((prev) => prev.filter((item) => item !== slug));
        setCustomTileColors((prev) => {
          if (!(slug in prev)) return prev;
          const next = { ...prev };
          delete next[slug];
          return next;
        });
        await loadServiceAreas(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete tile";
        toast.error(message);
      } finally {
        setDeleteTilePendingSlug(null);
      }
    },
    [loadServiceAreas],
  );

  const handleLoadSavedSearch = useCallback(
    (saved: SearchedCity) => {
      const label = `${properCapitalize(saved.city)}, ${saved.state}`;
      const syntheticLocation: LocationOption = {
        id: `saved-${saved.city}-${saved.state}-${saved.searchType}`,
        label,
        city: saved.city,
        state: saved.state,
        type: saved.searchType,
        zipCount: saved.searchResult.zips.length,
      };

      setActiveSavedSearchId(saved.id);
      setGenerationMode("cluster");
      setTileCount(4);
      setSelectedLocation(syntheticLocation);
      setLocationQuery(label);
      setStateFilter(saved.state);
      setSearchMode(saved.searchType);
      setShowLocationOptions(false);
      const placeFeature = (saved.searchResult.map?.place as GeoJSON.Feature) ?? null;
      const zipFeatures =
        (saved.searchResult.map?.includedZctas as GeoJSON.FeatureCollection) ?? null;
      const countyFeature = (saved.searchResult.map?.county as GeoJSON.Feature) ?? null;
      const countyCitiesCollection =
        (saved.searchResult.map?.countyCities as GeoJSON.FeatureCollection) ?? null;

      setPlaceGeometry(placeFeature);
      setPlaceZipFeatures(zipFeatures);
      setCountyGeometry(countyFeature);
      setCountyCityFeatures(countyCitiesCollection);
      if (countyCitiesCollection?.features?.length) {
        setShowCountyCityLabels(true);
      }

      mapFocusFeatureRef.current = countyFeature ?? placeFeature ?? null;
      shouldFitViewRef.current = Boolean(mapFocusFeatureRef.current);
      mapFitGeometryRef.current = null;
      setSelectedDraftTileId(null);
      setSelectedTileSlug(null);

      setResults({
        ...saved.searchResult,
        zips: saved.searchResult.zips ?? [],
        zipsWithoutGeometry: saved.searchResult.zipsWithoutGeometry ?? [],
      });
      setHasSearched(true);
      scrollToMap();

      const normalizedKey = `${saved.city.toLowerCase()}-${saved.state.toLowerCase()}-${saved.searchType}`;
      setSearchedCities((prev) => {
        const filtered = prev.filter((city) => {
          const key = `${city.city.toLowerCase()}-${city.state.toLowerCase()}-${city.searchType}`;
          return key !== normalizedKey;
        });
        const next = [saved, ...filtered];
        saveSearchedCities(next, businessId);
      return next;
    });

      setZipStatuses((prev) => {
        const next = { ...prev };
        saved.searchResult.zips.forEach((zipCode) => {
          if (!next[zipCode] || next[zipCode] === "error") {
            next[zipCode] = "available";
          }
        });
        return next;
      });
    },
    [businessId],
  );

  const handleDeleteSavedSearch = useCallback(
    (id: string) => {
      let nextActiveId: string | null = activeSavedSearchId;
      setSearchedCities((prev) => {
        const next = prev.filter((city) => city.id !== id);
        saveSearchedCities(next, businessId);
        if (nextActiveId === id) {
          nextActiveId = next[0]?.id ?? null;
        }
        return next;
      });
      if (nextActiveId !== activeSavedSearchId) {
        setActiveSavedSearchId(nextActiveId ?? null);
      }
    },
    [activeSavedSearchId, businessId],
  );

  const latestSearchedCity = searchedCities.at(-1) ?? null;
  const coveragePercent = results?.coverageStats?.coveragePercent ?? null;
  const uncoveredZipCount = results?.zipsWithoutGeometry?.length ?? 0;
  const totalZips = useMemo(
    () => serviceAreas.reduce((sum, area) => sum + area.zipCount, 0),
    [serviceAreas],
  );
  const totalTiles = serviceAreas.length;
  const liveTiles = useMemo(() => {
    if (typeof statusCounts.LIVE === "number") {
      return statusCounts.LIVE;
    }
    return serviceAreas.filter((area) => area.tile.status === "LIVE").length;
  }, [serviceAreas, statusCounts]);
  const conflictZipTotal = conflictSummary.conflictZipTotal;
  const needsReviewCount = conflictZipTotal > 0 ? conflictZipTotal : uncoveredZipCount;
  const averageCoverage = useMemo(() => {
    if (!serviceAreas.length) return null;
    const total = serviceAreas.reduce(
      (sum, area) => sum + area.coveragePercent,
      0,
    );
    return Number((total / serviceAreas.length).toFixed(1));
  }, [serviceAreas]);

  const heroMetrics = useMemo(
    () =>
      [
        {
          key: "active-zips",
          icon: MapPin,
          label: "Active ZIPs",
          value: totalZips.toLocaleString(),
          helper:
            totalTiles > 0
              ? `${liveTiles.toLocaleString()} live tiles`
              : "No tiles yet",
        },
        {
          key: "saved-searches",
          icon: Search,
          label: "Saved searches",
          value: searchedCities.length.toLocaleString(),
          helper: latestSearchedCity
            ? `${properCapitalize(latestSearchedCity.city)}, ${latestSearchedCity.state}`
            : "Search a city to get started",
        },
        {
          key: "coverage",
          icon: Globe2,
          label: "Coverage",
          value:
            averageCoverage !== null
              ? `${Math.min(averageCoverage, 100).toFixed(1)}%`
              : coveragePercent !== null
                ? `${Math.min(coveragePercent, 100).toFixed(1)}%`
                : "—",
          helper:
            averageCoverage !== null
              ? `${totalTiles.toLocaleString()} tiles measured`
              : coveragePercent !== null
                ? `${(results?.zips.length ?? 0).toLocaleString()} ZIPs scoped`
                : "Awaiting search",
        },
        {
          key: "needs-review",
          icon: AlertCircle,
          label: "Needs review",
          value: needsReviewCount.toLocaleString(),
          helper:
            conflictZipTotal > 0
              ? `${conflictZipTotal.toLocaleString()} ZIP conflict${conflictZipTotal === 1 ? "" : "s"}`
              : uncoveredZipCount > 0
                ? "Missing boundaries"
                : "Fully mapped",
        },
      ],
    [
      coveragePercent,
      latestSearchedCity,
      results?.zips.length,
      searchedCities,
      uncoveredZipCount,
      conflictZipTotal,
      needsReviewCount,
      averageCoverage,
      totalTiles,
      totalZips,
      liveTiles,
    ],
  );

  const filteredDraftTiles = useMemo(() => {
    const query = draftFilter.trim().toLowerCase();
    if (!query) return draftTiles;
    return draftTiles.filter((tile) =>
      [tile.name, tile.slug].some((value) => value.toLowerCase().includes(query)),
    );
  }, [draftFilter, draftTiles]);

  const totalDraftPages = useMemo(() => {
    if (draftFilter.trim()) {
      return Math.max(1, Math.ceil(filteredDraftTiles.length / PAGE_SIZE));
    }
    const total = draftTotalCount || filteredDraftTiles.length || 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [draftFilter, filteredDraftTiles.length, draftTotalCount]);
  const totalDraftCount = useMemo(() => {
    if (draftFilter.trim()) {
      return filteredDraftTiles.length;
    }
    return draftTotalCount || filteredDraftTiles.length;
  }, [draftFilter, filteredDraftTiles.length, draftTotalCount]);
  const visibleDraftTiles = useMemo(() => {
    if (showAllDrafts) return filteredDraftTiles;
    const start = (draftPage - 1) * PAGE_SIZE;
    return filteredDraftTiles.slice(start, start + PAGE_SIZE);
  }, [filteredDraftTiles, showAllDrafts, draftPage]);

  const filteredPublishedTiles = useMemo(() => {
    const query = publishedFilter.trim().toLowerCase();
    if (!query) return serviceAreas;
    return serviceAreas.filter((area) =>
      [area.tile.name, area.tile.slug].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [publishedFilter, serviceAreas]);

  const visiblePublishedTiles = useMemo(
    () => (showAllPublished ? filteredPublishedTiles : filteredPublishedTiles.slice(0, 8)),
    [filteredPublishedTiles, showAllPublished],
  );

  const visibleTileSlugs = useMemo(
    () => visiblePublishedTiles.map((area) => area.tile.slug),
    [visiblePublishedTiles],
  );
  const allVisibleSelected = useMemo(
    () =>
      visibleTileSlugs.length > 0 && visibleTileSlugs.every((slug) => selectedTileSlugs.includes(slug)),
    [selectedTileSlugs, visibleTileSlugs],
  );
  const someVisibleSelected = useMemo(
    () =>
      visibleTileSlugs.length > 0 &&
      !allVisibleSelected &&
      visibleTileSlugs.some((slug) => selectedTileSlugs.includes(slug)),
    [allVisibleSelected, selectedTileSlugs, visibleTileSlugs],
  );
  const selectedTileCount = selectedTileSlugs.length;

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedTileSlugs((prev) => {
      if (allVisibleSelected) {
        return prev.filter((slug) => !visibleTileSlugs.includes(slug));
      }
      return Array.from(new Set([...prev, ...visibleTileSlugs]));
    });
  }, [allVisibleSelected, visibleTileSlugs]);

  const startEditingPublishedTile = useCallback(
    (slug: string, currentName: string) => {
      if (renamingPublishedSlug) return;
      setEditingPublishedSlug(slug);
      setEditingPublishedName(currentName);
    },
    [renamingPublishedSlug],
  );

  const cancelEditingPublishedTile = useCallback(() => {
    setEditingPublishedSlug(null);
    setEditingPublishedName("");
  }, []);

  const commitPublishedTileName = useCallback(async () => {
    if (!editingPublishedSlug) return;
    if (renamingPublishedSlug) return;

    const trimmed = editingPublishedName.trim();
    const targetArea = serviceAreas.find((area) => area.tile.slug === editingPublishedSlug);

    if (!targetArea) {
      cancelEditingPublishedTile();
      return;
    }

    if (!trimmed) {
      toast.error("Tile name cannot be empty");
      return;
    }

    if (trimmed === targetArea.tile.name) {
      cancelEditingPublishedTile();
      return;
    }

    setRenamingPublishedSlug(editingPublishedSlug);
    try {
      await renameServiceTile(targetArea.tile.id, trimmed);
      setServiceAreas((prev) => {
        const updated = prev.map((area) =>
          area.tile.id === targetArea.tile.id
            ? {
                ...area,
                tile: {
                  ...area.tile,
                  name: trimmed,
                },
              }
            : area,
        );

        if (serviceAreaCacheRef.current) {
          serviceAreaCacheRef.current = {
            ...serviceAreaCacheRef.current,
            areas: updated,
            timestamp: Date.now(),
          };
        }

        return updated;
      });
      toast.success("Tile name updated");
      cancelEditingPublishedTile();
    } catch (error) {
      console.error("Failed to rename tile", error);
      toast.error(error instanceof Error ? error.message : "Failed to rename tile");
    } finally {
      setRenamingPublishedSlug(null);
    }
  }, [
    cancelEditingPublishedTile,
    editingPublishedName,
    editingPublishedSlug,
    renameServiceTile,
    serviceAreas,
    setServiceAreas,
    serviceAreaCacheRef,
    toast,
    renamingPublishedSlug,
  ]);

  const conflictDetails = useMemo(() => {
    if (!conflictSummary.conflictZips.length) return [] as Array<{
      zip: string;
      tiles: Array<{ slug: string; name: string; status: TileStatus }>;
    }>;

    const zipMap = new Map<string, Array<{ slug: string; name: string; status: TileStatus }>>();

    serviceAreas.forEach((area) => {
      area.zips.forEach((zip) => {
        if (!zipMap.has(zip.zip)) {
          zipMap.set(zip.zip, []);
        }
        zipMap.get(zip.zip)!.push({
          slug: area.tile.slug,
          name: area.tile.name,
          status: area.tile.status,
        });
      });
    });

    return conflictSummary.conflictZips.map((zip) => ({
      zip,
      tiles: zipMap.get(zip) ?? [],
    }));
  }, [conflictSummary.conflictZips, serviceAreas]);

  const visibleConflicts = useMemo(() => {
    if (!conflictDetails.length) return [] as typeof conflictDetails;
    return showAllConflicts ? conflictDetails : conflictDetails.slice(0, 6);
  }, [conflictDetails, showAllConflicts]);

  const focusTileSlug = useCallback(
    (tileSlug: string) => {
      let geometryFeature: GeoJSON.Feature | null = null;
      const target = serviceAreas.find((area) => area.tile.slug === tileSlug);
      if (target?.tileGeometry?.geometry) {
        geometryFeature = {
          type: "Feature",
          geometry: target.tileGeometry.geometry as GeoJSON.Geometry,
          properties: {},
        };
      } else {
        const draftTarget = draftTiles.find((tile) => tile.slug === tileSlug && tile.geometry);
        if (draftTarget?.geometry) {
          const geometry = draftTarget.geometry as GeoJSON.Feature;
          geometryFeature = {
            type: "Feature",
            geometry: geometry.geometry as GeoJSON.Geometry,
            properties: {},
          };
        }
      }

      if (geometryFeature) {
        mapFocusFeatureRef.current = geometryFeature;
        shouldFitViewRef.current = true;
        mapFitGeometryRef.current = null;
        flashFocusGeometry(geometryFeature);
        scrollToMap();
        lastMapFocusRef.current = `tile:${tileSlug}`;
      }

      const matchingDraft = draftTiles.find((tile) => tile.slug === tileSlug);
      if (matchingDraft) {
        setSelectedDraftTileId(matchingDraft.tileId);
        lastMapFocusRef.current = `draft:${matchingDraft.tileId}`;
      } else if (selectedDraftTileId) {
        setSelectedDraftTileId(null);
      }

      setSelectedTileSlug(tileSlug);
    },
    [
      draftTiles,
      flashFocusGeometry,
      scrollToMap,
      selectedDraftTileId,
      serviceAreas,
    ],
  );

  const focusZipOnMap = useCallback(
    (zip: string) => {
      const owningSlug = zipMetadata[zip]?.slug ?? null;
      if (owningSlug) {
        focusTileSlug(owningSlug);
        return;
      }

      const feature = placeZipFeatures?.features.find((entry) => {
        const props = entry.properties as Record<string, unknown> | undefined;
        return String(props?.zip ?? "") === zip;
      });

      if (feature) {
        const geometryFeature: GeoJSON.Feature = {
          type: "Feature",
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: {},
        };
        mapFocusFeatureRef.current = geometryFeature;
        shouldFitViewRef.current = true;
        mapFitGeometryRef.current = null;
        flashFocusGeometry(geometryFeature, { persist: true });
        setSelectedDraftTileId(null);
        setSelectedTileSlug(null);
        scrollToMap();
        lastMapFocusRef.current = `zip:${zip}`;
        return;
      }
    },
    [
      flashFocusGeometry,
      focusTileSlug,
      placeZipFeatures,
      scrollToMap,
      zipMetadata,
    ],
  );

  const selectedLocationLabel = useMemo(() => {
    if (!selectedLocation) return null;
    if (selectedLocation.type === "county") {
      return `${properCapitalize(selectedLocation.city)} County, ${selectedLocation.state}`;
    }
    return `${properCapitalize(selectedLocation.city)}, ${selectedLocation.state}`;
  }, [selectedLocation]);
  const selectedLocationType = selectedLocation?.type ?? null;

  const hasFailedZips = useMemo(
    () => Object.values(zipStatuses).some((status) => status === "error"),
    [zipStatuses],
  );
  const hasCountyCities = Boolean(countyCityFeatures?.features?.length);

  const mapHeaderActions = useMemo(() => {
    const currentColor = selectedTileSlug
      ? customTileColors[selectedTileSlug] ?? colorPickerValue
      : colorPickerValue;
    const hasCustomColor = selectedTileSlug ? Boolean(customTileColors[selectedTileSlug]) : false;

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-slate-300 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
          onClick={() => setIsMapExpanded((prev) => !prev)}
        >
          {isMapExpanded ? (
            <>
              <Minimize2 className="mr-2 h-4 w-4" /> Collapse map
            </>
          ) : (
            <>
              <Maximize2 className="mr-2 h-4 w-4" /> Expand map
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-slate-300 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
          onClick={() => colorInputRef.current?.click()}
          disabled={!selectedTileSlug}
        >
          <Palette className="mr-2 h-4 w-4" />
          {selectedTileSlug ? (hasCustomColor ? "Recolor tile" : "Color tile") : "Color tile"}
        </Button>
        <input
          ref={colorInputRef}
          type="color"
          value={currentColor}
          onChange={handleColorInputChange}
          className="hidden"
        />
        {selectedTileSlug && hasCustomColor ? (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs text-rose-500 hover:text-rose-600"
            onClick={() => handleClearColorForSelection([selectedTileSlug])}
          >
            Clear color
          </Button>
        ) : null}
      </div>
    );
  }, [
    colorPickerValue,
    customTileColors,
    handleClearColorForSelection,
    handleColorInputChange,
    isMapExpanded,
    selectedTileSlug,
  ]);

  const scrollToServiceAreas = useCallback(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("service-areas");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const scrollToSavedSearches = useCallback(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("saved-searches");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-mint border-t-transparent" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading coverage data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="admin-pill inline-flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Tile Studio
            </span>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
                Design, publish, and maintain service tiles
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                Scope new markets, cluster ZIP codes into balanced territories, and keep published tiles aligned with your live coverage—all in one workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {heroMetrics.map((metric) => (
            <div
              key={metric.key}
              className="admin-card min-w-[220px] snap-start rounded-2xl p-4 sm:min-w-0 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-mint/10 text-brand-mint dark:bg-brand-mint/15 dark:text-brand-mint">
                  <metric.icon className="h-4 w-4" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
                    {metric.value}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {metric.helper}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!serviceAreasLoading && serviceAreas.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" /> No service tiles found
            </div>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
              Create a service tile in the marketplace dashboard (or import tile GeoJSON via the PostGIS ETL) before assigning ZIPs. Once a tile exists it will appear in the target tile selector above.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="admin-card mt-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-400/70 dark:bg-rose-500/10 dark:text-rose-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">



          {isMapExpanded ? (
            <div
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setIsMapExpanded(false)}
            />
          ) : null}

          <div
            id="tile-studio-map-anchor"
            className={cn(
              "overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm transition-all dark:border-slate-700 dark:bg-slate-900/80",
              isMapExpanded
                ? "fixed inset-6 z-50 h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-none rounded-3xl border-slate-100/40 bg-white/98 shadow-2xl dark:border-slate-800/60 dark:bg-slate-950"
                : "",
            )}
          >
            <ZIPSearchMap
              searchResult={results}
              serviceAreaData={serviceAreaData}
              zipStatuses={stableZipStatuses}
              searchedCities={searchedCities}
              activeSavedSearchId={activeSavedSearchId}
              selectedTile={selectedTile}
              allServiceAreas={serviceAreas}
              draftTiles={draftTiles}
              selectedDraftTileId={selectedDraftTileId}
              placeGeometry={placeGeometry ?? undefined}
              placeZipFeatures={placeZipFeatures ?? undefined}
              onZipToggle={handleZipToggle}
              onBulkAdd={handleBulkAdd}
              onClearAll={handleClearAll}
              onClearSearchedCities={() => {
                setSearchedCities([]);
                saveSearchedCities([], businessId);
                setActiveSavedSearchId(null);
              }}
              onLoadSavedSearch={handleLoadSavedSearch}
              onDeleteSavedSearch={handleDeleteSavedSearch}
              onFocusZip={focusZipOnMap}
              loading={searching}
              showMaps={hasSearched}
              mapStyle={mapStylePreference.style}
              mapStyleId={mapStylePreference.key}
              mapStyleMode={mapStyleMode}
              mapStyleOptions={MAP_STYLE_OPTIONS}
              onMapStyleModeChange={(mode) => setMapStyleMode(mode as MapStyleMode)}
              onOpenMobileMapActions={() => setIsMobileMapSheetOpen(true)}
              mapId={MAP_ID}
              showTileLabels={showTileLabels}
              onToggleTileLabels={setTileLabelVisibility}
              showZipLabels={showZipLabels}
              onToggleZipLabels={setZipLabelVisibility}
              showPopulation={showPopulation}
              onTogglePopulation={setPopulationVisibility}
              showMunicipalityLabels={showCountyCityLabels}
              onToggleMunicipalityLabels={
                hasCountyCities ? setMunicipalityLabelVisibility : undefined
              }
              municipalityToggleLabel="City labels"
              searchMode={searchMode}
              onSearchModeChange={setSearchMode}
              stateOptions={US_STATES}
              stateFilter={stateFilter}
              onStateFilterChange={setStateFilter}
              locationQuery={locationQuery}
              onLocationQueryChange={handleLocationSearch}
              onLocationInputFocus={() => {
                setShowLocationOptions(true);
                if (locationQuery.trim().length >= 2) {
                  setSuggestionsLoading(true);
                }
              }}
              locationOptions={locationOptions}
              showLocationOptions={showLocationOptions}
              onSelectLocation={handleLocationSelect}
              onClearLocation={clearSelectedLocation}
              selectedLocationLabel={selectedLocationLabel}
              selectedLocationType={selectedLocationType}
              isSearching={searching}
              suggestionsLoading={suggestionsLoading}
              onSearchLocation={() => searchZips()}
              selectedLocation={selectedLocation}
              tileCount={tileCount}
              onTileCountChange={handleTileCountChange}
              canGenerateTiles={canGenerateTiles}
              onGenerateTiles={handleGenerateDraftTiles}
              isGeneratingTiles={isGeneratingTiles}
              generationMode={generationMode}
              onGenerationModeChange={handleGenerationModeChange}
              availableZipCount={availableZipCount}
              placeDetailsLoading={placeDetailsLoading}
              mapContainerClassName={cn(
                "bg-slate-950/5 dark:bg-slate-900/60",
                isMapExpanded ? "min-h-full h-full" : "",
              )}
              headerActions={mapHeaderActions}
            />
          </div>

          {(draftTilesLoading || draftTiles.length > 0 || isGeneratingTiles) && (
            <div
              id="tile-drafts"
              className="admin-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-mint text-sm font-bold text-white">
                    2
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Review draft tiles
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Publish or delete generated drafts and keep the strongest proposals front and center.
                    </p>
                  </div>
                </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Publish as
                  </Label>
                    <Select
                      value={publishStatus}
                      onValueChange={(value) => setPublishStatus(value as TileStatus)}
                    >
                      <SelectTrigger className="h-9 w-[140px] rounded-xl border-slate-300 bg-white text-sm font-medium dark:border-slate-600 dark:bg-slate-800">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUBLISHABLE_STATUSES.map((statusOption) => (
                          <SelectItem key={statusOption} value={statusOption}>
                            {statusOption.charAt(0) + statusOption.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void fetchDraftTiles(1, true);
                    }}
                    disabled={draftTilesLoading}
                    className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {draftTilesLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing…
                      </>
                    ) : (
                      "Refresh"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraftsCollapsed((prev) => !prev)}
                    className="rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    {draftsCollapsed ? (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" /> Expand
                      </>
                    ) : (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" /> Collapse
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {!draftsCollapsed ? (
                <>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <Label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Filter drafts
                    </Label>
                    <Input
                      value={draftFilter}
                    onChange={(event) => setDraftFilter(event.target.value)}
                    placeholder="Search by name or slug"
                    className="h-9 max-w-xs rounded-xl"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={showAllDrafts ? "outline" : "default"}
                    size="sm"
                    className="rounded-xl px-4 text-xs font-semibold"
                    onClick={() => setShowAllDrafts((prev) => !prev)}
                    disabled={totalDraftCount <= PAGE_SIZE}
                  >
                    {showAllDrafts
                      ? "Show paged view"
                      : `Show all drafts (${totalDraftCount})`}
                  </Button>
                  {!showAllDrafts && totalDraftPages > 1 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-slate-500 hover:text-brand-mint dark:text-slate-300"
                        disabled={draftPage === 1}
                        onClick={() => setDraftPage((prev) => Math.max(1, prev - 1))}
                      >
                        ←
                      </Button>
                      <span>
                        Page {draftPage} / {totalDraftPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-slate-500 hover:text-brand-mint dark:text-slate-300"
                        disabled={draftPage === totalDraftPages}
                        onClick={() => setDraftPage((prev) => Math.min(totalDraftPages, prev + 1))}
                      >
                        →
                      </Button>
                    </div>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs text-slate-500 hover:text-rose-500 dark:text-slate-300"
                  onClick={() => {
                    setDraftFilter("");
                    setShowAllDrafts(false);
                    setDraftPage(1);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

              {draftTilesLoading && draftTiles.length === 0 ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading draft tiles…
                </div>
              ) : null}

              {!draftTilesLoading && draftTiles.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  No draft tiles yet. Generate a market from the search workspace to queue new proposals.
                </div>
              ) : null}

              {draftTiles.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/70">
                  <Table>
                    <TableHeader className="bg-slate-100/70 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">ZIPs</TableHead>
                        <TableHead className="text-right">Population</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleDraftTiles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                            No drafts match this filter.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {visibleDraftTiles.map((tile) => {
                        const isSelected = selectedDraftTileId === tile.tileId;
                        const isPublishing =
                          draftActionPendingType === "publish" && draftActionPendingId === tile.tileId;
                        const isDeleting =
                          draftActionPendingType === "delete" && draftActionPendingId === tile.tileId;

                        return (
                          <TableRow
                            key={tile.tileId}
                            className={cn(
                              "text-sm transition hover:bg-brand-mint/10 dark:hover:bg-brand-mint/10",
                              isSelected && "bg-brand-mint/10 dark:bg-brand-mint/10",
                            )}
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900 dark:text-slate-100">{tile.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{tile.slug}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-700 dark:text-slate-200">
                              {tile.zipCount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-slate-600 dark:text-slate-300">
                              {tile.population ? tile.population.toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedDraftTileId(null);
                                      lastMapFocusRef.current = null;
                                      focusLockRef.current = null;
                                    } else {
                                      setSelectedDraftTileId(tile.tileId);
                                      focusTileSlug(tile.slug);
                                    }
                                  }}
                                >
                                  {isSelected ? "On map" : "Show"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  disabled={isPublishing}
                                  onClick={() => {
                                    void handlePublishDraftTile(tile.tileId);
                                  }}
                                >
                                  {isPublishing ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
                                    </>
                                  ) : (
                                    <>Publish ({publishStatus.toLowerCase()})</>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/20"
                                  disabled={isPublishing || isDeleting}
                                  onClick={() => {
                                    void handleDeleteDraftTile(tile.tileId);
                                  }}
                                >
                                  {isDeleting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    </>
                                  ) : (
                                    "Delete"
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
                </>
              ) : null}
            </div>
          )}

          {conflictSummary.conflictZipTotal > 0 ? (
            <div className="admin-card rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-200" />
                  <div>
                    <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                      {conflictSummary.conflictZipTotal.toLocaleString()} ZIP conflict
                      {conflictSummary.conflictZipTotal === 1 ? "" : "s"}
                    </h3>
                    <p className="text-sm text-amber-800/80 dark:text-amber-100/70">
                      Assign each ZIP to a single tile to eliminate routing issues.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-400/60 dark:text-amber-100"
                  onClick={() => setShowAllConflicts((prev) => !prev)}
                >
                  {showAllConflicts
                    ? "Collapse list"
                    : `Show all (${conflictDetails.length})`}
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {visibleConflicts.map((conflict) => {
                  const currentOwner = zipMetadata[conflict.zip]?.slug ?? null;
                  return (
                    <div
                      key={conflict.zip}
                      className="rounded-xl border border-amber-200/80 bg-white/90 p-4 shadow-sm dark:border-amber-400/30 dark:bg-slate-950/60"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => focusZipOnMap(conflict.zip)}
                            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            title={`Focus ZIP ${conflict.zip}`}
                          >
                            <Badge className="bg-amber-500 text-white">
                              {conflict.zip}
                            </Badge>
                          </button>
                          <span className="text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-200">
                            {conflict.tiles.length} tile conflict
                          </span>
                        </div>
                        {currentOwner ? (
                          <span className="text-xs text-amber-700/80 dark:text-amber-100/70">
                            Current owner: {currentOwner}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_minmax(0,260px)] md:items-center">
                        <div className="flex flex-wrap gap-2">
                          {conflict.tiles.map((tile) => (
                            <Badge
                              key={tile.slug}
                              variant="outline"
                              className={cn(
                                "rounded-full border-amber-200 text-amber-800 dark:border-amber-400/50 dark:text-amber-100",
                                tile.slug === currentOwner && "border-brand-mint/40 text-brand-mint dark:text-brand-mint",
                              )}
                            >
                              {tile.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {conflict.tiles.map((tile) => (
                            <div key={`${conflict.zip}-${tile.slug}`} className="flex items-center gap-2">
                              <Button
                                variant={tile.slug === currentOwner ? "default" : "outline"}
                                size="sm"
                                className="rounded-xl"
                                onClick={() => {
                                  void addZipToZone(conflict.zip, tile.slug);
                                }}
                              >
                                {tile.slug === currentOwner ? "Assigned" : `Assign to ${tile.name}`}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl text-slate-500 hover:text-brand-mint dark:text-slate-200"
                                onClick={() => focusTileSlug(tile.slug)}
                              >
                                View tile
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-amber-600 hover:bg-amber-100 dark:text-amber-100"
                            onClick={() => {
                              conflict.tiles.forEach((tile) => {
                                if (tile.slug !== currentOwner) {
                                  void removeZipFromZone(conflict.zip, tile.slug);
                                }
                              });
                            }}
                          >
                            Remove from others
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div
              id="service-areas"
              className="admin-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Service tiles</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {totalTiles.toLocaleString()} tiles covering {totalZips.toLocaleString()} ZIPs
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={publishedFilter}
                    onChange={(event) => setPublishedFilter(event.target.value)}
                    placeholder="Search tiles"
                    className="h-9 w-48 rounded-xl"
                  />
                  <Button
                    variant={showAllPublished ? "outline" : "default"}
                    size="sm"
                    className="rounded-xl px-4 text-xs font-semibold"
                    onClick={() => setShowAllPublished((prev) => !prev)}
                    disabled={filteredPublishedTiles.length <= 8}
                  >
                    {showAllPublished
                      ? "Show paged view"
                      : `Show all tiles (${filteredPublishedTiles.length})`}
                  </Button>
                  {hasFailedZips ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-amber-200 text-amber-600 hover:border-amber-300 hover:text-amber-700 dark:border-amber-500/70 dark:text-amber-200"
                      onClick={clearFailedZips}
                    >
                      Clear failed ZIPs
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                <div>
                  {selectedTileCount > 0 ? (
                    <span>
                      {selectedTileCount.toLocaleString()} tile{selectedTileCount === 1 ? "" : "s"} selected
                    </span>
                  ) : (
                    <span>Select tiles to create color-coded groups.</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={colorPickerValue}
                    onChange={(event) => setColorPickerValue(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-brand-mint/30 dark:border-slate-600"
                    aria-label="Select custom tile color"
                  />
                  <Button
                    size="sm"
                    className="rounded-xl bg-brand-mint px-3 text-white hover:bg-brand-mint/90"
                    onClick={() => handleAssignColorToSelection(colorPickerValue)}
                    disabled={selectedTileCount === 0}
                  >
                    Apply color
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-300 text-slate-600 hover:border-rose-200 hover:text-rose-600 dark:border-slate-600 dark:text-slate-200"
                    onClick={() => handleClearColorForSelection()}
                    disabled={selectedTileCount === 0}
                  >
                    Clear color
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-300"
                    onClick={clearTileSelection}
                    disabled={selectedTileCount === 0}
                  >
                    Reset selection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    onClick={() => {
                      setSelectedTileSlug(null);
                      setSelectedDraftTileId(null);
                      lastMapFocusRef.current = null;
                      focusLockRef.current = null;
                      flashFocusGeometry(null);
                    }}
                    disabled={!selectedTileSlug && !selectedDraftTileId}
                  >
                    Clear highlight
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/70">
                <Table>
                  <TableHeader className="bg-slate-100/70 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          aria-label="Select all visible tiles"
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={toggleSelectAllVisible}
                          className="h-4 w-4 rounded"
                        />
                      </TableHead>
                      <TableHead>Tile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">ZIPs</TableHead>
                      <TableHead className="text-right">Population</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePublishedTiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                          No tiles match this filter.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {visiblePublishedTiles.map((area) => {
                      const isSelected = selectedTileSlug === area.tile.slug;
                      const isChecked = selectedTileSlugs.includes(area.tile.slug);
                      const isEditing = editingPublishedSlug === area.tile.slug;
                      const isRenaming = renamingPublishedSlug === area.tile.slug;
                      const statusBadgeClass =
                        area.tile.status === "LIVE"
                          ? "bg-brand-mint/10 text-brand-mint border-brand-mint/40"
                          : area.tile.status === "WAITLIST"
                            ? "bg-amber-500/10 text-amber-600 border-amber-400/70"
                            : area.tile.status === "SUSPENDED"
                              ? "bg-rose-500/10 text-rose-600 border-rose-400/70"
                              : "bg-slate-500/10 text-slate-600 border-slate-400/70";
                      const zipList = area.zips.map((entry) => entry.zip).join(", ");
                      const populationValue =
                        area.totalPopulation ??
                        area.zips.reduce((sum, entry) => sum + (entry.population ?? 0), 0);
                      const disableRowActions = isRenaming || isEditing;

                      return (
                        <TableRow
                          key={area.tile.slug}
                          className={cn(
                            "text-sm transition hover:bg-brand-mint/10 dark:hover:bg-brand-mint/10",
                            isSelected && "bg-brand-mint/10 dark:bg-brand-mint/10",
                          )}
                        >
                          <TableCell className="w-12 align-middle">
                            <Checkbox
                              aria-label={`Select ${area.tile.name}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleTileSelection(area.tile.slug)}
                              className="h-4 w-4 rounded"
                            />
                          </TableCell>
                          <TableCell>
                            <div
                              className="space-y-1"
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                startEditingPublishedTile(area.tile.slug, area.tile.name);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {customTileColors[area.tile.slug] ? (
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: customTileColors[area.tile.slug] }}
                                  />
                                ) : (
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" aria-hidden="true" />
                                )}
                                {isEditing ? (
                                  <Input
                                    value={editingPublishedName}
                                    onChange={(event) => setEditingPublishedName(event.target.value)}
                                    onBlur={() => {
                                      void commitPublishedTileName();
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void commitPublishedTileName();
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelEditingPublishedTile();
                                      }
                                    }}
                                    autoFocus
                                    disabled={isRenaming}
                                    onClick={(event) => event.stopPropagation()}
                                    className="h-8 w-56 rounded-lg border-slate-300 text-sm focus-visible:ring-brand-mint"
                                  />
                                ) : (
                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {area.tile.name}
                                  </span>
                                )}
                                {isRenaming ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-brand-mint" />
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{area.tile.slug}</p>
                              {zipList ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                  ZIPs: {zipList}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500">No ZIPs assigned</p>
                              )}
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {populationValue
                                  ? `${populationValue.toLocaleString()} residents`
                                  : "Population unknown"}
                                {` • ${area.tile.minCertifiedScoopers.toLocaleString()} scooper min • ${area.tile.minCustomerUnits.toLocaleString()} weekly stops`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("rounded-full border text-xs font-medium", statusBadgeClass)}
                            >
                              {area.tile.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700 dark:text-slate-200">
                            {area.zipCount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-slate-600 dark:text-slate-300">
                            {populationValue
                              ? populationValue.toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className="rounded-xl"
                                disabled={disableRowActions}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTileSlug(null);
                                    lastMapFocusRef.current = null;
                                    focusLockRef.current = null;
                                  } else {
                                    focusTileSlug(area.tile.slug);
                                  }
                                }}
                              >
                                {isSelected ? "On map" : "Highlight"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/20"
                                disabled={disableRowActions}
                                onClick={() => {
                                  if (window.confirm(`Remove ${area.tile.name}?`)) {
                                    area.zips.forEach((entry) => {
                                      void removeZipFromZone(entry.zip, area.tile.slug);
                                    });
                                  }
                                }}
                              >
                                Clear ZIPs
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/70 dark:text-rose-300"
                                disabled={deleteTilePendingSlug === area.tile.slug || disableRowActions}
                                onClick={() => {
                                  if (window.confirm(`Delete ${area.tile.name}? This removes the tile and all assigned ZIPs.`)) {
                                    void handleDeleteServiceTile(area.tile.slug);
                                  }
                                }}
                              >
                                {deleteTilePendingSlug === area.tile.slug ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                                  </>
                                ) : (
                                  "Delete"
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="admin-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  ZIP status legend
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Added", color: "bg-brand-mint" },
                    { label: "Adding", color: "bg-amber-400" },
                    { label: "Removing", color: "bg-sky-400" },
                    { label: "Error", color: "bg-rose-500" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <span className={`h-3 w-3 rounded-full ${item.color}`}></span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 rounded-xl text-slate-600 hover:text-brand-mint dark:text-slate-300"
                  onClick={scrollToServiceAreas}
                >
                  Jump to service areas
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isMobileMapSheetOpen} onOpenChange={setIsMobileMapSheetOpen}>
        <SheetContent
          side="bottom"
          className="admin-card sm:hidden text-slate-900 dark:text-slate-100"
        >
          <SheetHeader className="space-y-1">
            <SheetTitle className="font-serif text-xl text-slate-900 dark:text-white">
              Map actions
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
              Quick tools for adjusting styles and reviewing saved data on the go.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Map style
              </p>
              <Select
                value={mapStyleMode}
                onValueChange={(value) => setMapStyleMode(value as MapStyleMode)}
              >
                <SelectTrigger className="mt-2 w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Map style" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {MAP_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Map layers
              </p>
              <div className="mt-2 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-12 w-full justify-between rounded-xl border px-4 text-left text-sm transition",
                    showTileLabels
                      ? "border-brand-mint/40 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                  )}
                  onClick={() => setTileLabelVisibility(!showTileLabels)}
                >
                  Tile names
                  <span
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showTileLabels ? "bg-brand-mint" : "bg-slate-300 dark:bg-slate-600",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        showTileLabels ? "translate-x-5" : "translate-x-1",
                      )}
                    />
                  </span>
                </Button>
                {hasCountyCities ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-12 w-full justify-between rounded-xl border px-4 text-left text-sm transition",
                      showCountyCityLabels
                        ? "border-brand-mint/40 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                    )}
                    onClick={() => setMunicipalityLabelVisibility(!showCountyCityLabels)}
                  >
                    City labels
                    <span
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        showCountyCityLabels
                          ? "bg-brand-mint"
                          : "bg-slate-300 dark:bg-slate-600",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          showCountyCityLabels ? "translate-x-5" : "translate-x-1",
                        )}
                      />
                    </span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-12 w-full justify-between rounded-xl border px-4 text-left text-sm transition",
                    showZipLabels
                      ? "border-brand-mint/40 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                  )}
                  onClick={() => setZipLabelVisibility(!showZipLabels)}
                >
                  ZIP codes
                  <span
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showZipLabels ? "bg-brand-mint" : "bg-slate-300 dark:bg-slate-600",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        showZipLabels ? "translate-x-5" : "translate-x-1",
                      )}
                    />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-12 w-full justify-between rounded-xl border px-4 text-left text-sm transition",
                    showPopulation
                      ? "border-brand-mint/40 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                  )}
                  onClick={() => setPopulationVisibility(!showPopulation)}
                >
                  Population estimates
                  <span
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showPopulation ? "bg-brand-mint" : "bg-slate-300 dark:bg-slate-600",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        showPopulation ? "translate-x-5" : "translate-x-1",
                      )}
                    />
                  </span>
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-12 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
                onClick={() => {
                  scrollToServiceAreas();
                  setIsMobileMapSheetOpen(false);
                }}
              >
                View service areas
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl border-slate-200 text-slate-700 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-200"
                onClick={() => {
                  scrollToSavedSearches();
                  setIsMobileMapSheetOpen(false);
                }}
              >
                Manage saved searches
              </Button>
              <Button
                className="h-12 rounded-xl bg-brand-mint text-white shadow-sm transition hover:bg-brand-mint/90"
                onClick={() => {
                  setSearchedCities([]);
                  saveSearchedCities([], businessId);
                  setActiveSavedSearchId(null);
                  setIsMobileMapSheetOpen(false);
                }}
              >
                Clear saved cities
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
