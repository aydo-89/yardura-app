"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { type MapEventType, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

const GLYPH_FALLBACK_BASE = "https://demotiles.maplibre.org/font";

export interface MapLibreMapProps {
  id: string;
  center?: [number, number];
  zoom?: number;
  style?: string | StyleSpecification;
  styleKey?: string;
  className?: string;
  onClick?: (e: maplibregl.MapMouseEvent) => void;
  onLoad?: (map: maplibregl.Map) => void;
  interactive?: boolean;
}

type LayerType = "fill" | "line" | "circle" | "symbol";

export interface GeoJsonLayer {
  id: string;
  data: GeoJSON.FeatureCollection | GeoJSON.Feature;
  visible?: boolean;
  layerType?: LayerType;
  fillColor?: string | maplibregl.Expression;
  fillOpacity?: number | maplibregl.Expression;
  strokeColor?: string | maplibregl.Expression;
  strokeWidth?: number | maplibregl.Expression;
  strokeOpacity?: number | maplibregl.Expression;
  circleColor?: string | maplibregl.Expression;
  circleOpacity?: number | maplibregl.Expression;
  circleRadius?: number | maplibregl.Expression;
  circleStrokeColor?: string | maplibregl.Expression;
  circleStrokeWidth?: number | maplibregl.Expression;
  textField?: string | maplibregl.Expression;
  textSize?: number | maplibregl.Expression;
  textColor?: string | maplibregl.Expression;
  textHaloColor?: string | maplibregl.Expression;
  textHaloWidth?: number | maplibregl.Expression;
  textFont?: string[];
  textOffset?: [number, number];
  symbolPlacement?: "point" | "line" | "line-center" | string;
}

export interface LayerInfo {
  id: string;
  layerType: LayerType;
  added: boolean;
  visible: boolean;
  sourceExists: boolean;
  layerIds: string[];
  data: GeoJSON.FeatureCollection | GeoJSON.Feature;
  config: Omit<GeoJsonLayer, "id" | "data">;
}

export interface MapLibreMapRef {
  map: maplibregl.Map | null;
  addGeoJsonLayer: (layer: GeoJsonLayer) => void;
  removeLayer: (layerId: string) => void;
  updateLayerData: (
    layerId: string,
    data: GeoJSON.FeatureCollection | GeoJSON.Feature,
  ) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  getLayerInfo: (layerId: string) => LayerInfo | undefined;
  getAllLayers: () => LayerInfo[];
  fitToData: (
    data: GeoJSON.FeatureCollection | GeoJSON.Feature,
    options?: maplibregl.FitBoundsOptions,
  ) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
}

type MapErrorEvent = MapEventType["error"] & {
  sourceId?: string;
  source?: { type?: string };
  tile?: {
    tileID?: {
      canonical?: {
        z: number;
        x: number;
        y: number;
      };
    };
  };
  dataType?: string;
};

interface ParsedMapError {
  benign: boolean;
  key?: string;
  message?: string;
  context?: Record<string, unknown>;
}

const MAP_ERROR_NOISE_PATTERNS = [
  /aborted/i,
  /cancell?ed/i,
  /request was cancelled/i,
  /socket hang up/i,
  /no longer needed/i,
];

const sanitizeErrorMessage = (message: string) =>
  message.replace(/\d+(?:\.\d+)?/g, "{n}");

const FALLBACK_FONTSTACK = encodeURIComponent("Open Sans Regular");
const SECONDARY_FONTSTACK = encodeURIComponent("Open Sans Regular,Arial Unicode MS Regular");

const rewriteGlyphUrl = (url: string): string => {
  if (!url.includes("/font/")) return url;

  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/font\/([^/]+)\/(.+\.pbf)$/);
    if (!match) return url;

    const requestedStack = match[1];
    const range = match[2];

    return `${GLYPH_FALLBACK_BASE}/${SECONDARY_FONTSTACK}/${range}`;
  } catch (error) {
    console.warn("Failed to rewrite glyph URL", error);
    return url;
  }
};

const parseMapErrorEvent = (
  mapId: string,
  event: MapErrorEvent,
): ParsedMapError => {
  const rawError = (event as MapErrorEvent & { error?: unknown }).error;

  if (!rawError) {
    return { benign: true };
  }

  const errorObject =
    typeof rawError === "object" && rawError !== null ? (rawError as Record<string, unknown>) : undefined;

  const message =
    typeof rawError === "string"
      ? rawError
      : typeof errorObject?.message === "string"
        ? (errorObject.message as string)
        : undefined;

  const statusValue = errorObject?.status;
  const status =
    typeof statusValue === "number"
      ? statusValue
      : typeof statusValue === "string"
        ? Number(statusValue)
        : undefined;

  const errorName =
    typeof errorObject?.name === "string" ? (errorObject.name as string) : undefined;
  const errorCode =
    typeof errorObject?.code === "string" ? (errorObject.code as string) : undefined;

  const isAbort =
    errorName === "AbortError" ||
    (errorCode && /abort|cancel/i.test(errorCode)) ||
    (typeof message === "string" && /abort|cancel/i.test(message)) ||
    status === 0;

  if (isAbort) {
    return { benign: true };
  }

  if (typeof message === "string") {
    const isNoise = MAP_ERROR_NOISE_PATTERNS.some((pattern) => pattern.test(message));
    if (isNoise) {
      return { benign: true };
    }
  }

  const sourceId =
    event.sourceId ??
    (typeof errorObject?.sourceId === "string" ? (errorObject.sourceId as string) : undefined);

  const tile = event.tile?.tileID?.canonical;
  const tileLabel =
    tile && typeof tile.z === "number"
      ? `z${tile.z}/x${tile.x}/y${tile.y}`
      : undefined;

  const url =
    typeof errorObject?.url === "string" ? (errorObject.url as string) : undefined;

  const normalizedMessage =
    typeof message === "string" ? sanitizeErrorMessage(message) : undefined;

  const key =
    [
      sourceId,
      status !== undefined ? `status:${status}` : undefined,
      normalizedMessage,
    ]
      .filter(Boolean)
      .join("|") || "generic";

  const summaryParts: string[] = [];
  if (status !== undefined && !Number.isNaN(status)) summaryParts.push(`status ${status}`);
  if (sourceId) summaryParts.push(`source ${sourceId}`);
  if (tileLabel) summaryParts.push(tileLabel);

  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : message ?? "Unknown map error";

  const context: Record<string, unknown> = {
    mapId,
    status,
    sourceId,
    url,
    tile,
    message,
    rawError,
  };

  return {
    benign: false,
    key,
    message: summary,
    context,
  };
};

// Global protocol registration to avoid duplicate registration
let pmtilesProtocolRegistered = false;

// Define map style once to prevent re-creation
const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f8f9fa",
      },
    },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 0.8,
      },
    },
  ],
};

const cloneStyle = (
  style: string | StyleSpecification,
): string | StyleSpecification => {
  if (typeof style === "string") return style;
  try {
    return JSON.parse(JSON.stringify(style)) as StyleSpecification;
  } catch (error) {
    console.warn("Failed to clone map style", error);
    return style;
  }
};

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 4;

const MapLibreMap = ({
  id,
  center,
  zoom,
  style = DEFAULT_MAP_STYLE,
  styleKey,
  className = "",
  onClick,
  onLoad,
  interactive = true,
}: MapLibreMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleKey = useRef<string | undefined>(undefined);
  const currentStyleRef = useRef<string | StyleSpecification>(style);
  const initialCenterRef = useRef<[number, number]>(center ?? DEFAULT_CENTER);
  const initialZoomRef = useRef<number>(typeof zoom === "number" ? zoom : DEFAULT_ZOOM);
  const pendingLayerRestore = useRef<
    Array<{
      id: string;
      data: GeoJSON.FeatureCollection | GeoJSON.Feature;
      config: Omit<GeoJsonLayer, "id" | "data">;
    }>
  >([]);

  // Layer registry to track all layers and their state
  const layerRegistry = useRef<Map<string, LayerInfo>>(new Map());
  const errorStatsRef = useRef<
    Map<string, { count: number; lastLogged: number; suppressed: boolean }>
  >(new Map());
  const appliedCenterRef = useRef<[number, number] | null>(Array.isArray(center) ? center : null);
  const appliedZoomRef = useRef<number | null>(typeof zoom === "number" ? zoom : null);

  // Initialize PMTiles protocol once
  useEffect(() => {
    if (!pmtilesProtocolRegistered && typeof window !== "undefined") {
      try {
        const protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
        pmtilesProtocolRegistered = true;
        console.log("PMTiles protocol registered");
      } catch (error) {
        console.warn("Failed to register PMTiles protocol:", error);
      }
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log(`Initializing map ${id} - this should only happen once`);

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: cloneStyle(style),
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        interactive,
        attributionControl: false,
        // Optimize for vector data
        maxZoom: 18,
        minZoom: 0,
        // Disable default scroll zoom when not interactive
        scrollZoom: interactive,
        boxZoom: interactive,
        dragRotate: false,
        dragPan: interactive,
        keyboard: interactive,
        doubleClickZoom: interactive,
        touchZoomRotate: interactive,
        transformRequest: (url, resourceType) => {
          if (resourceType === "Glyphs" && url.includes("/fonts/")) {
            const rewritten = rewriteGlyphUrl(url);
            if (rewritten !== url) {
              return { url: rewritten };
            }
          }
          return { url };
        },
      });

      currentStyleKey.current = styleKey;
      currentStyleRef.current = style;

      // Add navigation control if interactive
      if (interactive) {
        map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      }

      // Handle map load
      map.current.on("load", () => {
        console.log(`Map ${id} loaded`);
        setIsLoaded(true);
        onLoad?.(map.current!);
      });

      // Handle style data load (when style is fully loaded)
      map.current.on("styledata", () => {
        console.log(`Map ${id} style loaded - ready for layer operations`);
        setIsStyleLoaded(true);
      });

      // Also listen for style.load to be extra sure
      map.current.on("style.load", () => {
        console.log(`Map ${id} style.load event fired`);
        setIsStyleLoaded(true);
      });

      // Handle clicks
      if (onClick) {
        map.current.on("click", onClick);
      }

      // Add hover effects for better interactivity
      map.current.on("mouseenter", () => {
        map.current!.getCanvas().style.cursor = "pointer";
      });

      map.current.on("mouseleave", () => {
        map.current!.getCanvas().style.cursor = "";
      });

      // Handle errors with deduplication to avoid console spam from tile retries
      map.current.on("error", (event) => {
        const parsed = parseMapErrorEvent(id, event as MapErrorEvent);

        if (parsed.benign || !parsed.key || !parsed.message) {
          return;
        }

        const stats =
          errorStatsRef.current.get(parsed.key) ?? {
            count: 0,
            lastLogged: 0,
            suppressed: false,
          };

        stats.count += 1;
        const now = Date.now();
        const shouldLogFull = stats.count <= 3 || now - stats.lastLogged > 60_000;

        if (shouldLogFull) {
          console.error(`Map ${id} error: ${parsed.message}`, parsed.context);
          stats.lastLogged = now;
          stats.suppressed = false;
        } else if (!stats.suppressed) {
          console.warn(
            `Map ${id} error: ${parsed.message} (occurrences: ${stats.count})  -  suppressing further duplicate logs`,
            parsed.context,
          );
          stats.lastLogged = now;
          stats.suppressed = true;
        }

        errorStatsRef.current.set(parsed.key, stats);
      });
    } catch (error) {
      console.error(`Failed to initialize map ${id}:`, error);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setIsLoaded(false);
        setIsStyleLoaded(false);
      }
      // Clear layer registry
      layerRegistry.current.clear();
      errorStatsRef.current.clear();
    };
  }, [id]); // Only re-initialize if id changes

  const centerLng = Array.isArray(center) ? center[0] : null;
  const centerLat = Array.isArray(center) ? center[1] : null;

  useEffect(() => {
    if (map.current) return;
    if (Array.isArray(center)) {
      initialCenterRef.current = [center[0], center[1]];
    }
    if (typeof zoom === "number") {
      initialZoomRef.current = zoom;
    }
  }, [centerLng, centerLat, zoom]);

  // Update center and zoom when props change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    if (Array.isArray(center)) {
      const [lng, lat] = center;
      const previous = appliedCenterRef.current;
      if (!previous || previous[0] !== lng || previous[1] !== lat) {
        map.current.setCenter([lng, lat]);
        appliedCenterRef.current = [lng, lat];
      }
    } else {
      appliedCenterRef.current = null;
    }

    if (typeof zoom === "number") {
      if (appliedZoomRef.current === null || appliedZoomRef.current !== zoom) {
        map.current.setZoom(zoom);
        appliedZoomRef.current = zoom;
      }
    } else {
      appliedZoomRef.current = null;
    }
  }, [centerLng, centerLat, zoom, isLoaded]);

  // Enhanced layer management with registry and idempotent operations
  const addGeoJsonLayer = useCallback(
    (layer: GeoJsonLayer) => {
      if (!map.current || !isStyleLoaded) {
        console.log(
          `Map ${id} not ready for layer operations - map: ${!!map.current}, style loaded: ${isStyleLoaded}`,
        );
        return;
      }

      const { id: layerId, data, visible = true, layerType = "fill", ...config } = layer;

      const existingInfo = layerRegistry.current.get(layerId);
      if (existingInfo && existingInfo.added) {
        console.log(`Layer ${layerId} already exists, updating instead`);
        updateLayerData(layerId, data);
        setLayerVisibility(layerId, visible);
        return;
      }

      try {
        const style = map.current.getStyle();
        if (!style || !style.sources || !style.layers) {
          console.warn(`Map ${id} style not fully available, skipping layer ${layerId}`);
          return;
        }

        cleanupLayer(layerId);

        map.current.addSource(layerId, {
          type: "geojson",
          data,
          generateId: true,
        });

        const layerIds: string[] = [];

        const setVisibility = visible ? "visible" : "none";

        if (layerType === "fill") {
          const fillColor = config.fillColor || "#22c55e";
          const fillOpacity = config.fillOpacity || 0.3;
          const strokeColor = config.strokeColor || "#16a34a";
          const strokeWidth = config.strokeWidth || 2;
          const strokeOpacity = config.strokeOpacity || 0.8;

          map.current.addLayer({
            id: layerId,
            type: "fill",
            source: layerId,
            paint: {
              "fill-color": fillColor as string,
              "fill-opacity": fillOpacity as number,
            },
            layout: {
              visibility: setVisibility,
            },
          });
          layerIds.push(layerId);

          map.current.addLayer({
            id: `${layerId}-stroke`,
            type: "line",
            source: layerId,
            paint: {
              "line-color": strokeColor as string,
              "line-width": strokeWidth as number,
              "line-opacity": strokeOpacity as number,
            },
            layout: {
              visibility: setVisibility,
            },
          });
          layerIds.push(`${layerId}-stroke`);
        } else if (layerType === "line") {
          const strokeColor = config.strokeColor || "#2563eb";
          const strokeWidth = config.strokeWidth || 3;
          const strokeOpacity = config.strokeOpacity ?? 0.9;
          map.current.addLayer({
            id: layerId,
            type: "line",
            source: layerId,
            layout: {
              "line-cap": "round",
              "line-join": "round",
              visibility: setVisibility,
            },
            paint: {
              "line-color": strokeColor as string,
              "line-width": strokeWidth as number,
              "line-opacity": strokeOpacity as number,
            },
          });
          layerIds.push(layerId);
        } else if (layerType === "circle") {
          const circleColor = config.circleColor || "#3b82f6";
          const circleRadius = config.circleRadius || 6;
          const circleOpacity = config.circleOpacity ?? 1;
          const circleStrokeColor = config.circleStrokeColor || "#ffffff";
          const circleStrokeWidth = config.circleStrokeWidth ?? 1.5;

          map.current.addLayer({
            id: layerId,
            type: "circle",
            source: layerId,
            paint: {
              "circle-color": circleColor as any,
              "circle-radius": circleRadius as any,
              "circle-opacity": circleOpacity as any,
              "circle-stroke-color": circleStrokeColor as any,
              "circle-stroke-width": circleStrokeWidth as any,
            },
            layout: {
              visibility: setVisibility,
            },
          });
          layerIds.push(layerId);
        } else if (layerType === "symbol") {
          const textField = config.textField || ["get", "label"];
          const textSize = config.textSize || 12;
          const textColor = config.textColor || "#0f172a";
          const textHaloColor = config.textHaloColor || "rgba(255,255,255,0.85)";
          const textHaloWidth = config.textHaloWidth ?? 1.25;
          const textFont = config.textFont || ["Open Sans Bold", "Arial Unicode MS Bold"];
          const textOffset = config.textOffset || [0, 0];
          const symbolPlacement = (config.symbolPlacement || "point") as any;

          map.current.addLayer({
            id: layerId,
            type: "symbol",
            source: layerId,
            layout: {
              "text-field": textField as any,
              "text-size": textSize as any,
              "text-font": textFont,
              "text-offset": textOffset,
              "symbol-placement": symbolPlacement,
              visibility: setVisibility,
            },
            paint: {
              "text-color": textColor as any,
              "text-halo-color": textHaloColor as any,
              "text-halo-width": textHaloWidth as any,
            },
          });
          layerIds.push(layerId);
        }

        layerRegistry.current.set(layerId, {
          id: layerId,
          layerType,
          added: true,
          visible,
          sourceExists: true,
          layerIds,
          data,
          config: {
            ...config,
            visible,
            layerType,
          },
        });

        console.log(`Added layer: ${layerId}`);
      } catch (error) {
        console.error(`Failed to add layer ${layerId}:`, error);
        layerRegistry.current.set(layerId, {
          id: layerId,
          layerType,
          added: false,
          visible,
          sourceExists: false,
          layerIds: [],
          data,
          config: {
            ...config,
            visible,
            layerType,
          },
        });
      }
    },
    [isLoaded, isStyleLoaded, id],
  );

  // Helper function to clean up existing layer components
  const cleanupLayer = useCallback((layerId: string) => {
    if (!map.current) return;

    try {
      const info = layerRegistry.current.get(layerId);
      const idsToRemove = info?.layerIds ?? [layerId, `${layerId}-stroke`];
      idsToRemove.forEach((idToRemove) => {
        if (idToRemove && map.current!.getLayer(idToRemove)) {
          map.current!.removeLayer(idToRemove);
        }
      });
      if (map.current.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
    } catch (error) {
      console.warn(`Error during cleanup of layer ${layerId}:`, error);
    }
  }, []);

  // Update layer data
  const updateLayerData = useCallback(
    (layerId: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
      if (!map.current) return;

      const layerInfo = layerRegistry.current.get(layerId);
      if (!layerInfo || !layerInfo.sourceExists) {
        console.warn(`Cannot update layer ${layerId}: source does not exist`);
        return;
      }

      try {
        const source = map.current.getSource(layerId) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (source && "setData" in source) {
          source.setData(data);

          // Update registry
          layerRegistry.current.set(layerId, {
            ...layerInfo,
            data,
          });

          console.log(`Updated data for layer: ${layerId}`);
        }
      } catch (error) {
        console.error(`Failed to update data for layer ${layerId}:`, error);
      }
    },
    [],
  );

  // Set layer visibility
  const setLayerVisibility = useCallback(
    (layerId: string, visible: boolean) => {
      if (!map.current) return;

      const layerInfo = layerRegistry.current.get(layerId);
      if (!layerInfo || !layerInfo.added) {
        console.warn(
          `Cannot set visibility for layer ${layerId}: layer not added`,
        );
        return;
      }

      try {
        const visibility = visible ? "visible" : "none";
        const targetLayers = layerInfo.layerIds.length > 0 ? layerInfo.layerIds : [layerId];

        targetLayers.forEach((targetId) => {
          if (targetId && map.current!.getLayer(targetId)) {
            map.current!.setLayoutProperty(targetId, "visibility", visibility);
          }
        });

        // Update registry
        layerRegistry.current.set(layerId, {
          ...layerInfo,
          visible,
        });

        console.log(`Set visibility for layer ${layerId}: ${visible}`);
      } catch (error) {
        console.error(`Failed to set visibility for layer ${layerId}:`, error);
      }
    },
    [],
  );

  // Get layer info
  const getLayerInfo = useCallback((layerId: string): LayerInfo | undefined => {
    return layerRegistry.current.get(layerId);
  }, []);

  // Swap basemap styles without recreating the map instance
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const incomingKey = styleKey ?? "__default";
    const styleChanged = currentStyleRef.current !== style;
    const keyChanged = currentStyleKey.current !== incomingKey;

    if (!styleChanged && !keyChanged) {
      return;
    }

    currentStyleKey.current = incomingKey;
    currentStyleRef.current = style;

    const storedLayers = Array.from(layerRegistry.current.values()).map((layer) => ({
      id: layer.id,
      data: layer.data,
      config: layer.config,
    }));

    pendingLayerRestore.current = storedLayers;
    layerRegistry.current.clear();
    setIsStyleLoaded(false);

    const preparedStyle = cloneStyle(style);

    const handleStyleData = () => {
      setIsStyleLoaded(true);
    };

    map.current.once("styledata", handleStyleData);
    map.current.setStyle(preparedStyle);

    return () => {
      map.current?.off("styledata", handleStyleData);
    };
  }, [style, styleKey, isLoaded]);

  // Restore stored layers after a style swap completes
  useEffect(() => {
    if (!isLoaded || !isStyleLoaded) return;
    if (!map.current) return;
    if (pendingLayerRestore.current.length === 0) return;

    const layersToRestore = [...pendingLayerRestore.current];
    pendingLayerRestore.current = [];

    layersToRestore.forEach((layer) => {
      addGeoJsonLayer({
        id: layer.id,
        data: layer.data,
        ...layer.config,
        visible: layer.config.visible ?? true,
      });
    });
  }, [isLoaded, isStyleLoaded, addGeoJsonLayer]);

  // Get all layers
  const getAllLayers = useCallback((): LayerInfo[] => {
    return Array.from(layerRegistry.current.values());
  }, []);

  const removeLayer = useCallback(
    (layerId: string) => {
      if (!map.current || !isLoaded || !isStyleLoaded) return;

      const layerInfo = layerRegistry.current.get(layerId);
      if (!layerInfo) {
        console.warn(`Layer ${layerId} not found in registry`);
        return;
      }

      try {
        // Clean up layers and source
        cleanupLayer(layerId);

        // Remove from registry
        layerRegistry.current.delete(layerId);

        console.log(`Removed layer: ${layerId}`);
      } catch (error) {
        console.error(`Failed to remove layer ${layerId}:`, error);

        // Update registry to reflect removal attempt
        layerRegistry.current.set(layerId, {
          ...layerInfo,
          added: false,
          sourceExists: false,
          layerIds: [],
        });
      }
    },
    [isLoaded, isStyleLoaded, cleanupLayer],
  );

  const fitToData = useCallback(
    (data: GeoJSON.FeatureCollection | GeoJSON.Feature, options?: maplibregl.FitBoundsOptions) => {
      if (!map.current) {
        console.log("fitToData: No map instance");
        return;
      }

      // Check map readiness directly from the map instance, not React state
      if (!map.current.loaded() || !map.current.isStyleLoaded()) {
        console.log("fitToData: Map not ready, queueing for idle event");
        // Queue the fitToData for when the map is ready
        map.current.once("idle", () => {
          console.log("fitToData: Map ready after idle, retrying");
          fitToData(data);
        });
        return;
      }

      try {
        const bounds = new maplibregl.LngLatBounds();

        // Calculate bounds from GeoJSON
        const collectBounds = (coords: any) => {
          if (
            Array.isArray(coords) &&
            coords.length >= 2 &&
            typeof coords[0] === "number" &&
            typeof coords[1] === "number"
          ) {
            bounds.extend([coords[0], coords[1]]);
          } else if (Array.isArray(coords)) {
            coords.forEach(collectBounds);
          }
        };

        if (data.type === "FeatureCollection") {
          data.features.forEach((feature) => {
            if (feature.geometry && "coordinates" in feature.geometry) {
              collectBounds(feature.geometry.coordinates);
            }
          });
        } else {
          if (data.geometry && "coordinates" in data.geometry) {
            collectBounds(data.geometry.coordinates);
          }
        }

        if (!bounds.isEmpty()) {
          const defaultOptions: maplibregl.FitBoundsOptions = {
            padding: 20,
            maxZoom: 14,
            duration: 1000,
          };

          map.current.fitBounds(bounds, {
            ...defaultOptions,
            ...options,
          });
          console.log("Fitted map to data bounds successfully");
        } else {
          console.log("fitToData: Bounds are empty, cannot zoom");
        }
      } catch (error) {
        console.error("Failed to fit map to data:", error);
      }
    },
    [],
  );

  const setCenter = useCallback(
    (newCenter: [number, number]) => {
      if (!map.current || !isLoaded || !isStyleLoaded) return;
      map.current.setCenter(newCenter);
    },
    [isLoaded, isStyleLoaded],
  );

  const setZoom = useCallback(
    (newZoom: number) => {
      if (!map.current || !isLoaded || !isStyleLoaded) return;
      map.current.setZoom(newZoom);
    },
    [isLoaded, isStyleLoaded],
  );

  // Expose methods via global object for parent components
  useEffect(() => {
    if (typeof window !== "undefined" && map.current) {
      (window as any)[`maplibre_${id}`] = {
        map: map.current,
        addGeoJsonLayer,
        removeLayer,
        updateLayerData,
        setLayerVisibility,
        getLayerInfo,
        getAllLayers,
        fitToData,
        setCenter,
        setZoom,
      };
      console.log(
        `Map ${id} exposed to global window object with enhanced API`,
      );
    }
  }, [
    id,
    addGeoJsonLayer,
    removeLayer,
    updateLayerData,
    setLayerVisibility,
    getLayerInfo,
    getAllLayers,
    fitToData,
    setCenter,
    setZoom,
  ]);

  return (
    <div
      ref={mapContainer}
      id={id}
      className={`maplibre-map ${className}`}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "300px",
        borderRadius: "0.375rem",
        overflow: "hidden",
      }}
    />
  );
};

export default MapLibreMap;
