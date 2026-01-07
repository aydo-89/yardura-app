"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import CitySearch from "./CitySearch";
import ZipChecker from "./ZipChecker";
import type { CityStatus } from "@/lib/cityData";

interface CityData {
  name: string;
  displayName: string;
  state: string;
  liveStatus: CityStatus;
  tileCount: number;
  zipCount: number;
  population: number;
  activeScoopers: number;
  hasLiveTiles: boolean;
  waitlistSignups: number;
}

interface CityPageClientProps {
  cities: CityData[];
}

export default function CityPageClient({ cities }: CityPageClientProps) {
  const [highlightedCity, setHighlightedCity] = useState<string | null>(null);
  const [zipSearched, setZipSearched] = useState<string | null>(null);
  const citySearchRef = useRef<HTMLDivElement>(null);

  const handleZipFound = useCallback((zip: string, cityName: string | null) => {
    setZipSearched(zip || null);
    setHighlightedCity(cityName?.toLowerCase().replace(/\s+/g, "-") ?? null);
    
    // Scroll to city search section if a city was found
    if (cityName && citySearchRef.current) {
      setTimeout(() => {
        citySearchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, []);

  return (
    <>
      {/* ZIP Checker in Hero */}
      <div className="pt-4">
        <ZipChecker onZipFound={handleZipFound} />
      </div>
      
      {/* City Search Section - passed as children or separate */}
      <div ref={citySearchRef}>
        <CitySearch 
          cities={cities} 
          highlightedCity={highlightedCity}
          initialZipSearch={zipSearched}
        />
      </div>
    </>
  );
}






