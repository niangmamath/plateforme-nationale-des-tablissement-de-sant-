/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Etablissement, MapStyle } from '../types';
import { Maximize, Compass, MapPin, Map, Sun, Moon } from 'lucide-react';

interface InteractiveMapProps {
  establishments: Etablissement[];
  selectedId: string | null;
  onSelectEstablishment: (establishment: Etablissement) => void;
}

export default function InteractiveMap({
  establishments,
  selectedId,
  onSelectEstablishment
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [currentStyle, setCurrentStyle] = useState<MapStyle>('google-streets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Configuration de la palette et des icônes par catégorie
  const CATEGORY_CONFIG: Record<string, { color: string, svg: string }> = {
    'Clinique Privée': {
      color: '#2563eb', // Bleu
      svg: `<path d="M19 12H5M12 19V5"/>` // Bâtiment (plus simple)
    },
    'Ophtalmologie': {
      color: '#0891b2', // Cyan
      svg: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/>` // Oeil
    },
    'Dermatologie': {
      color: '#9333ea', // Violet
      svg: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>` // Goutte (Peau)
    },
    'default': {
      color: '#475569', // Gris (pour le reste)
      svg: `<circle cx="12" cy="12" r="10"/>` // Cercle par défaut
    }
  };

  // Map Tile Layers Configuration
  const TILE_LAYERS = {
    'google-streets': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    'google-hybrid': {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA...'
    },
    'light-carto': {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    'dark-carto': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  };

  // Helper: Create custom modern SVG marker icons for Leaflet
  const createSvgIcon = (category: string, isSelected: boolean) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
    
    const scale = isSelected ? 'scale-125 z-[999]' : 'hover:scale-110';
    const shadow = isSelected ? 'shadow-lg shadow-slate-900/40' : 'shadow-md';

    const html = `
      <div class="relative flex items-center justify-center ${scale} transition-transform duration-200">
        ${isSelected ? `<div class="absolute -inset-2.5 bg-slate-900/20 rounded-full animate-ping duration-1000"></div>` : ''}
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${shadow}" style="background-color: ${config.color}; border: 2px solid #ffffff;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white">
            ${config.svg}
          </svg>
        </div>
        <div class="absolute bottom-[-4px] w-2 h-2 rotate-45" style="background-color: ${config.color}; border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff; left: calc(50% - 4px);"></div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: html,
      iconSize: [32, 36],
      iconAnchor: [16, 36],
      popupAnchor: [0, -32]
    });
  };

  // Setup/Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [33.5731, -7.5898],
      zoom: 6,
      zoomControl: false,
      attributionControl: false
    });

    mapRef.current = map;
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    const activeConfig = TILE_LAYERS[currentStyle];
    L.tileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      maxZoom: 19
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Tile Layer when style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const activeConfig = TILE_LAYERS[currentStyle];
    L.tileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      maxZoom: 19
    }).addTo(map);
  }, [currentStyle]);

  // Handle markers list updates and map fits
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markersRef.current = {};

    if (establishments.length === 0) return;

    const bounds: L.LatLngTuple[] = [];

    establishments.forEach((etab) => {
      const isSelected = etab.id === selectedId;
      const markerIcon = createSvgIcon(etab.categorie, isSelected);

      const marker = L.marker([etab.latitude, etab.longitude], {
        icon: markerIcon
      });

      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${etab.latitude},${etab.longitude}&query_place_id=${etab.placeId}`;
      const popupHtml = `
        <div class="p-4 font-sans min-w-[220px]" style="line-height: 1.4;">
          <div class="flex items-center justify-between gap-2 mb-2 border-b border-slate-200 pb-2">
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">${etab.categorie}</span>
            <span class="text-[9px] text-slate-400 font-bold uppercase">${etab.source}</span>
          </div>
          <h4 class="text-xs font-black text-slate-900 mb-1 leading-tight tracking-tight">${etab.nom}</h4>
          <p class="text-[10px] text-slate-500 mb-3 flex items-start gap-1 font-semibold">
            <svg class="h-3 w-3 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>${etab.quartier || etab.arrondissement}, ${etab.ville}</span>
          </p>
          <div class="flex flex-col gap-1 text-[9px] text-slate-400 bg-slate-50 border border-slate-200 p-2 rounded-lg mb-3">
            <div><strong class="text-slate-700 font-bold uppercase text-[8px] tracking-wider">Adresse:</strong> ${etab.adresse}</div>
            <div class="flex justify-between mt-1.5 pt-1.5 border-t border-slate-200 font-semibold">
              <span>GPS: ${etab.latitude.toFixed(4)}, ${etab.longitude.toFixed(4)}</span>
            </div>
          </div>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 px-2 rounded-lg text-[9px] uppercase tracking-wider shadow-sm transition-colors no-underline">
            Ouvrir Google Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 260,
        className: 'custom-leaflet-popup'
      });

      marker.on('click', () => {
        onSelectEstablishment(etab);
      });

      markersRef.current[etab.id] = marker;
      layerGroup.addLayer(marker);

      bounds.push([etab.latitude, etab.longitude]);
    });

    if (bounds.length > 1 && !selectedId) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (bounds.length === 1 && !selectedId) {
      map.setView(bounds[0], 12);
    }
  }, [establishments]);

  // Sync External selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    const marker = markersRef.current[selectedId];
    if (marker) {
      const latlng = marker.getLatLng();
      
      establishments.forEach((etab) => {
        const m = markersRef.current[etab.id];
        if (m) {
          m.setIcon(createSvgIcon(etab.categorie, etab.id === selectedId));
        }
      });

      map.flyTo(latlng, 15, { animate: true, duration: 1.2 });

      setTimeout(() => {
        marker.openPopup();
      }, 350);
    }
  }, [selectedId]);

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 14, { duration: 1.5 });
      },
      () => {
        map.flyTo([33.5731, -7.5898], 12, { duration: 1.5 });
      }
    );
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => { mapRef.current?.invalidateSize(); }, 200);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => { document.removeEventListener('fullscreenchange', handleFsChange); };
  }, []);

  // Génération dynamique de la légende
  const activeCategories = useMemo(() => {
    const uniqueCats = Array.from(new Set(establishments.map(e => e.categorie)));
    return uniqueCats.map(cat => ({
      name: cat,
      color: CATEGORY_CONFIG[cat]?.color || CATEGORY_CONFIG['default'].color
    }));
  }, [establishments]);

  return (
    <div className="relative w-full h-full min-h-[450px] lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col bg-slate-100">
      
      {/* Map Control Bar (Header) */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        
        {/* Left: Layer Selector */}
        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-md border border-slate-200 pointer-events-auto">
          <button onClick={() => setCurrentStyle('google-streets')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'google-streets' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Map className="h-3.5 w-3.5" /><span>Plan</span>
          </button>
          <button onClick={() => setCurrentStyle('google-hybrid')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'google-hybrid' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Compass className="h-3.5 w-3.5" /><span>Sat</span>
          </button>
          <button onClick={() => setCurrentStyle('light-carto')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'light-carto' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Sun className="h-3.5 w-3.5" /><span>Clair</span>
          </button>
          <button onClick={() => setCurrentStyle('dark-carto')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'dark-carto' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Moon className="h-3.5 w-3.5" /><span>Noir</span>
          </button>
        </div>

        {/* Right: Custom map utility actions */}
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={handleLocateMe} className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer" title="Me géolocaliser">
            <MapPin className="h-4.5 w-4.5 stroke-[2.5]" />
          </button>
          <button onClick={toggleFullscreen} className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer" title="Mode plein écran">
            <Maximize className="h-4.5 w-4.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Map DOM Element */}
      <div id="leaflet-map-element" ref={containerRef} className="w-full flex-1 min-h-[400px] z-[10]" />

      {/* Visual map legend overlay (Dynamique !) */}
      {activeCategories.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-md hidden sm:block pointer-events-none">
          <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">LÉGENDE</h4>
          <div className="flex flex-col gap-2 text-[10px] font-bold text-slate-600">
            {activeCategories.map(cat => (
              <div key={cat.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full inline-block shadow-sm" style={{ backgroundColor: cat.color }}></span>
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}