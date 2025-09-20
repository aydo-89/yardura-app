'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapLibreMapProps {
  id: string;
  center?: [number, number];
  zoom?: number;
  style?: string | StyleSpecification;
  className?: string;
  onClick?: (e: maplibregl.MapMouseEvent) => void;
  onLoad?: (map: maplibregl.Map) => void;
  interactive?: boolean;
}

export interface GeoJsonLayer {
  id: string;
  data: GeoJSON.FeatureCollection | GeoJSON.Feature;
  fillColor?: string | maplibregl.Expression;
  fillOpacity?: number | maplibregl.Expression;
  strokeColor?: string | maplibregl.Expression;
  strokeWidth?: number | maplibregl.Expression;
  strokeOpacity?: number | maplibregl.Expression;
  visible?: boolean;
}

export interface LayerInfo {
  id: string;
  added: boolean;
  visible: boolean;
  sourceExists: boolean;
  fillLayerExists: boolean;
  strokeLayerExists: boolean;
  data: GeoJSON.FeatureCollection | GeoJSON.Feature;
  config: Omit<GeoJsonLayer, 'id' | 'data'>;
}

export interface MapLibreMapRef {
  map: maplibregl.Map | null;
  addGeoJsonLayer: (layer: GeoJsonLayer) => void;
  removeLayer: (layerId: string) => void;
  updateLayerData: (layerId: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  getLayerInfo: (layerId: string) => LayerInfo | undefined;
  getAllLayers: () => LayerInfo[];
  fitToData: (data: GeoJSON.FeatureCollection | GeoJSON.Feature) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
}

// Global protocol registration to avoid duplicate registration
let pmtilesProtocolRegistered = false;

// Define map style once to prevent re-creation
const DEFAULT_MAP_STYLE: StyleSpecification = {
  "version": 8,
  "sources": {
    "carto": {
      "type": "raster",
      "tiles": [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
      ],
      "tileSize": 256,
      "attribution": "© OpenStreetMap contributors, © CARTO"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#f8f9fa"
      }
    },
    {
      "id": "carto",
      "type": "raster",
      "source": "carto",
      "paint": {
        "raster-opacity": 0.8
      }
    }
  ]
};

const MapLibreMap = ({
  id,
  center = [-98.5795, 39.8283], // US center
  zoom = 4,
  style = DEFAULT_MAP_STYLE,
  className = '',
  onClick,
  onLoad,
  interactive = true
}: MapLibreMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Layer registry to track all layers and their state
  const layerRegistry = useRef<Map<string, LayerInfo>>(new Map());

  // Initialize PMTiles protocol once
  useEffect(() => {
    if (!pmtilesProtocolRegistered && typeof window !== 'undefined') {
      try {
        const protocol = new Protocol();
        maplibregl.addProtocol('pmtiles', protocol.tile);
        pmtilesProtocolRegistered = true;
        console.log('PMTiles protocol registered');
      } catch (error) {
        console.warn('Failed to register PMTiles protocol:', error);
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
        style,
        center,
        zoom,
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
      });

      // Add navigation control if interactive
      if (interactive) {
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
      }

      // Handle map load
      map.current.on('load', () => {
        console.log(`Map ${id} loaded`);
        setIsLoaded(true);
        onLoad?.(map.current!);
      });

      // Handle style data load (when style is fully loaded)
      map.current.on('styledata', () => {
        console.log(`Map ${id} style loaded - ready for layer operations`);
        setIsStyleLoaded(true);
      });

      // Also listen for style.load to be extra sure
      map.current.on('style.load', () => {
        console.log(`Map ${id} style.load event fired`);
        setIsStyleLoaded(true);
      });

      // Handle clicks
      if (onClick) {
        map.current.on('click', onClick);
      }

      // Add hover effects for better interactivity
      map.current.on('mouseenter', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', () => {
        map.current!.getCanvas().style.cursor = '';
      });

      // Handle errors
      map.current.on('error', (e) => {
        console.error(`Map ${id} error:`, e);
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
    };
  }, [id]); // Only re-initialize if id changes

  // Update center and zoom when props change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    if (center) {
      map.current.setCenter(center);
    }
    if (zoom !== undefined) {
      map.current.setZoom(zoom);
    }
  }, [center, zoom, isLoaded]);

  // Enhanced layer management with registry and idempotent operations
  const addGeoJsonLayer = useCallback((layer: GeoJsonLayer) => {
    if (!map.current || !isLoaded || !isStyleLoaded) {
      console.log(`Map ${id} not ready for layer operations - loaded: ${isLoaded}, style loaded: ${isStyleLoaded}`);
      return;
    }

    const { id: layerId, data, visible = true, ...config } = layer;
    const fillColor = config.fillColor || '#22c55e';
    const fillOpacity = config.fillOpacity || 0.3;
    const strokeColor = config.strokeColor || '#16a34a';
    const strokeWidth = config.strokeWidth || 2;
    const strokeOpacity = config.strokeOpacity || 0.8;

    // Get existing layer info or create new
    const existingInfo = layerRegistry.current.get(layerId);
    if (existingInfo && existingInfo.added) {
      // Layer already exists, update it instead
      console.log(`Layer ${layerId} already exists, updating instead`);
      updateLayerData(layerId, data);
      setLayerVisibility(layerId, visible);
      return;
    }

    try {
      // Check if map style is really loaded
      const style = map.current.getStyle();
      if (!style || !style.sources || !style.layers) {
        console.warn(`Map ${id} style not fully available, skipping layer ${layerId}`);
        return;
      }

      // Clean up any existing remnants (idempotent operation)
      cleanupLayer(layerId);

      // Add source
      map.current.addSource(layerId, {
        type: 'geojson',
        data,
        generateId: true // For click handling
      });

      // Add fill layer
      const fillLayerConfig: any = {
        id: layerId,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': fillColor as string,
          'fill-opacity': fillOpacity as number,
        },
        layout: {
          visibility: visible ? 'visible' : 'none'
        }
      };
      map.current.addLayer(fillLayerConfig);

      // Add stroke layer
      const strokeLayerConfig: any = {
        id: `${layerId}-stroke`,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': strokeColor as string,
          'line-width': strokeWidth as number,
          'line-opacity': strokeOpacity as number,
        },
        layout: {
          visibility: visible ? 'visible' : 'none'
        }
      };
      map.current.addLayer(strokeLayerConfig);

      // Register layer in registry
      layerRegistry.current.set(layerId, {
        id: layerId,
        added: true,
        visible,
        sourceExists: true,
        fillLayerExists: true,
        strokeLayerExists: true,
        data,
        config: { fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, visible }
      });

      console.log(`Added layer: ${layerId}`);
    } catch (error) {
      console.error(`Failed to add layer ${layerId}:`, error);

      // Update registry with failed state
      layerRegistry.current.set(layerId, {
        id: layerId,
        added: false,
        visible,
        sourceExists: false,
        fillLayerExists: false,
        strokeLayerExists: false,
        data,
        config: { fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, visible }
      });
    }
  }, [isLoaded, isStyleLoaded, id]);

  // Helper function to clean up existing layer components
  const cleanupLayer = useCallback((layerId: string) => {
    if (!map.current) return;

    try {
      // Remove layers (stroke first, then fill)
      if (map.current.getLayer(`${layerId}-stroke`)) {
        map.current.removeLayer(`${layerId}-stroke`);
      }
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      // Remove source
      if (map.current.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
    } catch (error) {
      console.warn(`Error during cleanup of layer ${layerId}:`, error);
    }
  }, []);

  // Update layer data
  const updateLayerData = useCallback((layerId: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
    if (!map.current) return;

    const layerInfo = layerRegistry.current.get(layerId);
    if (!layerInfo || !layerInfo.sourceExists) {
      console.warn(`Cannot update layer ${layerId}: source does not exist`);
      return;
    }

    try {
      const source = map.current.getSource(layerId) as maplibregl.GeoJSONSource | undefined;
      if (source && 'setData' in source) {
        source.setData(data);

        // Update registry
        layerRegistry.current.set(layerId, {
          ...layerInfo,
          data
        });

        console.log(`Updated data for layer: ${layerId}`);
      }
    } catch (error) {
      console.error(`Failed to update data for layer ${layerId}:`, error);
    }
  }, []);

  // Set layer visibility
  const setLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    if (!map.current) return;

    const layerInfo = layerRegistry.current.get(layerId);
    if (!layerInfo || !layerInfo.added) {
      console.warn(`Cannot set visibility for layer ${layerId}: layer not added`);
      return;
    }

    try {
      // Set visibility for both fill and stroke layers
      const visibility = visible ? 'visible' : 'none';

      if (layerInfo.fillLayerExists) {
        map.current.setLayoutProperty(layerId, 'visibility', visibility);
      }

      if (layerInfo.strokeLayerExists) {
        map.current.setLayoutProperty(`${layerId}-stroke`, 'visibility', visibility);
      }

      // Update registry
      layerRegistry.current.set(layerId, {
        ...layerInfo,
        visible
      });

      console.log(`Set visibility for layer ${layerId}: ${visible}`);
    } catch (error) {
      console.error(`Failed to set visibility for layer ${layerId}:`, error);
    }
  }, []);

  // Get layer info
  const getLayerInfo = useCallback((layerId: string): LayerInfo | undefined => {
    return layerRegistry.current.get(layerId);
  }, []);

  // Get all layers
  const getAllLayers = useCallback((): LayerInfo[] => {
    return Array.from(layerRegistry.current.values());
  }, []);

  const removeLayer = useCallback((layerId: string) => {
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
        fillLayerExists: false,
        strokeLayerExists: false
      });
    }
  }, [isLoaded, isStyleLoaded, cleanupLayer]);

  const fitToData = useCallback((data: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
    if (!map.current || !isLoaded || !isStyleLoaded) return;

    try {
      const bounds = new maplibregl.LngLatBounds();

      // Calculate bounds from GeoJSON
      const collectBounds = (coords: any) => {
        if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          bounds.extend([coords[0], coords[1]]);
        } else if (Array.isArray(coords)) {
          coords.forEach(collectBounds);
        }
      };

      if (data.type === 'FeatureCollection') {
        data.features.forEach(feature => {
          if (feature.geometry && 'coordinates' in feature.geometry) {
            collectBounds(feature.geometry.coordinates);
          }
        });
      } else {
        if (data.geometry && 'coordinates' in data.geometry) {
          collectBounds(data.geometry.coordinates);
        }
      }

      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, {
          padding: 20,
          maxZoom: 14,
          duration: 1000
        });
        console.log('Fitted map to data bounds');
      }
    } catch (error) {
      console.error('Failed to fit map to data:', error);
    }
  }, [isLoaded, isStyleLoaded]);

  const setCenter = useCallback((newCenter: [number, number]) => {
    if (!map.current || !isLoaded || !isStyleLoaded) return;
    map.current.setCenter(newCenter);
  }, [isLoaded, isStyleLoaded]);

  const setZoom = useCallback((newZoom: number) => {
    if (!map.current || !isLoaded || !isStyleLoaded) return;
    map.current.setZoom(newZoom);
  }, [isLoaded, isStyleLoaded]);

  // Expose methods via global object for parent components
  useEffect(() => {
    if (typeof window !== 'undefined' && map.current) {
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
      console.log(`Map ${id} exposed to global window object with enhanced API`);
    }
  }, [id, addGeoJsonLayer, removeLayer, updateLayerData, setLayerVisibility, getLayerInfo, getAllLayers, fitToData, setCenter, setZoom]);

  return (
    <div
      ref={mapContainer}
      id={id}
      className={`maplibre-map ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        borderRadius: '0.375rem',
        overflow: 'hidden'
      }}
    />
  );
};

export default MapLibreMap;
