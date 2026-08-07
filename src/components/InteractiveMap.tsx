/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Etablissement, MapStyle } from '../types';
import { Maximize, Compass, MapPin, Map as MapIcon, Sun, Moon, Radar, X, Ruler } from 'lucide-react';

interface InteractiveMapProps {
  establishments: Etablissement[];
  selectedId: string | null;
  onSelectEstablishment: (establishment: Etablissement) => void;
  center?: [number, number];
  zoom?: number;
}

export default function InteractiveMap({
  establishments,
  selectedId,
  onSelectEstablishment,
  center = [33.5731, -7.5898], // Casablanca par défaut
  zoom = 12
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  
  // Refs pour les outils d'analyse géospatiale
  const radiusLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerGroupRef = useRef<L.LayerGroup | null>(null); // NOUVEAU : Calque pour la localisation utilisateur
  
  const [currentStyle, setCurrentStyle] = useState<MapStyle>('google-streets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // NOUVEAU : État pour stocker la position GPS de l'utilisateur
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // États : Rayon
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<L.LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [countInRadius, setCountInRadius] = useState<number | null>(null);

  // États : Distance
  const [isDistanceMode, setIsDistanceMode] = useState(false);
  const [distancePoints, setDistancePoints] = useState<L.LatLng[]>([]);

  const CATEGORY_CONFIG: Record<string, { color: string, svg: string }> = {
    'Clinique Privée': {
      color: '#2563eb',
      svg: `<path d="M19 12H5M12 19V5"/>`
    },
    'Ophtalmologie': {
      color: '#0891b2',
      svg: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/>`
    },
    'Dermatologie': {
      color: '#9333ea',
      svg: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`
    },
    'default': {
      color: '#475569',
      svg: `<circle cx="12" cy="12" r="10"/>`
    }
  };

  const TILE_LAYERS = {
    'google-streets': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    'google-hybrid': {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri'
    },
    'light-carto': {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap'
    },
    'dark-carto': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap'
    }
  };

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

    return L.divIcon({ className: 'custom-leaflet-marker', html: html, iconSize: [32, 36], iconAnchor: [16, 36], popupAnchor: [0, -32] });
  };

  // Initialisation Map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, { center: center, zoom: zoom, zoomControl: false, attributionControl: false });
    mapRef.current = map;
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    const activeConfig = TILE_LAYERS[currentStyle];
    L.tileLayer(activeConfig.url, { attribution: activeConfig.attribution, maxZoom: 19 }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    radiusLayerGroupRef.current = L.layerGroup().addTo(map);
    distanceLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocationLayerGroupRef.current = L.layerGroup().addTo(map); // Init calque localisation

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); 

  useEffect(() => { mapRef.current?.flyTo(center, zoom, { animate: true, duration: 1.5 }); }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    L.tileLayer(TILE_LAYERS[currentStyle].url, { attribution: TILE_LAYERS[currentStyle].attribution, maxZoom: 19 }).addTo(map);
  }, [currentStyle]);

  // NOUVEAU : Afficher le marqueur rouge de la localisation utilisateur
  useEffect(() => {
    const map = mapRef.current;
    const uGroup = userLocationLayerGroupRef.current;
    if (!map || !uGroup) return;

    uGroup.clearLayers();

    if (userLocation) {
      // Création d'un marqueur HTML rouge avec effet "ping"
      const html = `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-3 bg-red-500/40 rounded-full animate-ping duration-1000"></div>
          <div class="relative flex items-center justify-center w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-lg shadow-red-900/50">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `;
      
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: html,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -12]
      });

      const marker = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 });
      
      const popupContent = `
        <div class="text-center p-2 min-w-[120px]">
          <div class="text-[11px] text-slate-800 font-black tracking-wide">Vous êtes ici</div>
          <div class="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Localisation GPS</div>
        </div>
      `;
      
      marker.bindPopup(popupContent, { className: 'custom-leaflet-popup', closeButton: false });
      uGroup.addLayer(marker);
      
      // Ouvre la popup automatiquement quand on trouve la position
      setTimeout(() => marker.openPopup(), 400);
    }
  }, [userLocation]);

  // Gérer les clics pour Rayon ET Distance
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (isRadiusMode) {
        setRadiusCenter(e.latlng);
      } else if (isDistanceMode) {
        setDistancePoints(prev => prev.length === 2 ? [e.latlng] : [...prev, e.latlng]);
      }
    };

    if (isRadiusMode || isDistanceMode) {
      map.on('click', onMapClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.off('click', onMapClick);
      map.getContainer().style.cursor = '';
      if (!isRadiusMode) setRadiusCenter(null);
      if (!isDistanceMode) setDistancePoints([]);
    }

    return () => {
      map.off('click', onMapClick);
      map.getContainer().style.cursor = '';
    };
  }, [isRadiusMode, isDistanceMode]);

  // Rendu du Rayon
  useEffect(() => {
    const map = mapRef.current;
    const rGroup = radiusLayerGroupRef.current;
    if (!map || !rGroup) return;

    rGroup.clearLayers();
    setCountInRadius(null);

    if (isRadiusMode && radiusCenter) {
      const radiusMeters = radiusKm * 1000;
      const circle = L.circle(radiusCenter, { radius: radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' });
      const centerMarker = L.circleMarker(radiusCenter, { radius: 6, color: '#1e3a8a', fillColor: '#ffffff', fillOpacity: 1, weight: 3 });

      let count = 0;
      establishments.forEach(e => {
        if (map.distance(radiusCenter, L.latLng(e.latitude, e.longitude)) <= radiusMeters) count++;
      });
      setCountInRadius(count);

      const popupContent = `
        <div class="text-center p-2 min-w-[120px]">
          <div class="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Zone d'Impact</div>
          <div class="text-xs text-slate-800 font-black mb-2">Rayon : ${radiusKm} km</div>
          <div class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-200 shadow-sm">${count} résultat(s)</div>
        </div>
      `;
      centerMarker.bindPopup(popupContent, { closeButton: false, className: 'radius-popup' }).openPopup();
      rGroup.addLayer(circle);
      rGroup.addLayer(centerMarker);
    }
  }, [isRadiusMode, radiusCenter, radiusKm, establishments]);

  // Rendu de la Distance
  useEffect(() => {
    const map = mapRef.current;
    const dGroup = distanceLayerGroupRef.current;
    if (!map || !dGroup) return;

    dGroup.clearLayers();

    if (isDistanceMode && distancePoints.length > 0) {
      const [p1, p2] = distancePoints;
      dGroup.addLayer(L.circleMarker(p1, { radius: 6, color: '#be123c', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }));

      if (p2) {
        dGroup.addLayer(L.circleMarker(p2, { radius: 6, color: '#be123c', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }));
        const line = L.polyline([p1, p2], { color: '#e11d48', weight: 4, dashArray: '8, 8' });
        const distanceKm = (map.distance(p1, p2) / 1000).toFixed(2);
        
        line.bindTooltip(`${distanceKm} km`, { 
          permanent: true, 
          direction: 'center', 
          className: 'font-black text-sm bg-white border border-rose-200 px-2 py-1 rounded shadow-sm text-rose-600' 
        });
        
        dGroup.addLayer(line);
      }
    }
  }, [isDistanceMode, distancePoints]);

  // Affichage des établissements
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markersRef.current = {};

    if (establishments.length === 0) return;

    const bounds: L.LatLngTuple[] = [];

    establishments.forEach((etab) => {
      const marker = L.marker([etab.latitude, etab.longitude], { icon: createSvgIcon(etab.categorie, etab.id === selectedId) });

      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${etab.latitude},${etab.longitude}&query_place_id=${etab.placeId}`;
      const popupHtml = `
        <div class="p-4 font-sans min-w-[220px]" style="line-height: 1.4;">
          <div class="flex items-center justify-between gap-2 mb-2 border-b border-slate-200 pb-2">
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">${etab.categorie}</span>
            <span class="text-[9px] text-slate-400 font-bold uppercase">${etab.source}</span>
          </div>
          <h4 class="text-xs font-black text-slate-900 mb-1 leading-tight tracking-tight">${etab.nom}</h4>
          <p class="text-[10px] text-slate-500 mb-3 font-semibold">${etab.quartier || etab.arrondissement}, ${etab.ville}</p>
          <div class="text-[9px] text-slate-400 bg-slate-50 border border-slate-200 p-2 rounded-lg mb-3">
            <strong class="text-slate-700 font-bold uppercase text-[8px] tracking-wider">Adresse:</strong> ${etab.adresse}
          </div>
          <a href="${googleMapsUrl}" target="_blank" class="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 px-2 rounded-lg text-[9px] uppercase tracking-wider shadow-sm transition-colors no-underline">Ouvrir Google Maps</a>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260, className: 'custom-leaflet-popup' });
      marker.on('click', () => onSelectEstablishment(etab));
      markersRef.current[etab.id] = marker;
      layerGroup.addLayer(marker);
      bounds.push([etab.latitude, etab.longitude]);
    });

    if (bounds.length > 1 && !selectedId) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    else if (bounds.length === 1 && !selectedId) map.setView(bounds[0], 12);
  }, [establishments]);

  // Focus externe
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || !markersRef.current[selectedId]) return;
    
    const marker = markersRef.current[selectedId];
    establishments.forEach((etab) => {
      const m = markersRef.current[etab.id];
      if (m) m.setIcon(createSvgIcon(etab.categorie, etab.id === selectedId));
    });

    map.flyTo(marker.getLatLng(), 15, { animate: true, duration: 1.2 });
    setTimeout(() => { marker.openPopup(); }, 350);
  }, [selectedId]);

  // Toggles intelligents
  const handleToggleRadius = () => {
    setIsRadiusMode(!isRadiusMode);
    if (!isRadiusMode) setIsDistanceMode(false);
  };

  const handleToggleDistance = () => {
    setIsDistanceMode(!isDistanceMode);
    if (!isDistanceMode) setIsRadiusMode(false);
  };

  // NOUVEAU : Fonction dédiée pour la localisation
  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    
    // Demande la position au navigateur
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Met à jour l'état, ce qui déclenchera le useEffect affichant le point rouge
        setUserLocation([latitude, longitude]);
        // Centre la carte sur l'utilisateur
        map.flyTo([latitude, longitude], 15, { duration: 1.5 });
      },
      () => {
        // En cas d'erreur (permission refusée), retourne au centre de la ville
        map.flyTo(center, zoom, { duration: 1.5 });
      }
    );
  };

  const activeCategories = useMemo(() => Array.from(new Set(establishments.map(e => e.categorie))).map(cat => ({
    name: cat, color: CATEGORY_CONFIG[cat]?.color || CATEGORY_CONFIG['default'].color
  })), [establishments]);

  return (
    <div className="relative w-full h-full min-h-[450px] lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col bg-slate-100">
      
      {/* Panneau de Contrôle Rayon */}
      {isRadiusMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-blue-200 shadow-xl pointer-events-auto flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-blue-700">
              <Radar className="h-4 w-4 stroke-[2.5]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Analyse par Rayon</span>
            </div>
            <button onClick={() => setIsRadiusMode(false)} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 rounded-lg p-1"><X className="h-4 w-4 stroke-[3]" /></button>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex justify-between">
              <span>Distance du rayon</span><span className="text-blue-700 font-black">{radiusKm} km</span>
            </label>
            <input type="range" min="1" max="50" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>

          {!radiusCenter ? (
            <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez n'importe où sur la carte pour placer le centre.</p>
          ) : (
            <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-lg flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Établissements ciblés</span>
              <span className="text-sm font-black text-blue-700">{countInRadius ?? 0}</span>
            </div>
          )}
        </div>
      )}

      {/* Panneau de Contrôle Distance */}
      {isDistanceMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-rose-200 shadow-xl pointer-events-auto flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-rose-700">
              <Ruler className="h-4 w-4 stroke-[2.5]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mesure de Distance</span>
            </div>
            <button onClick={() => setIsDistanceMode(false)} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 rounded-lg p-1"><X className="h-4 w-4 stroke-[3]" /></button>
          </div>
          
          {distancePoints.length === 0 && (
            <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez sur la carte pour placer le <span className="font-bold text-rose-600">Point A</span>.</p>
          )}
          {distancePoints.length === 1 && (
            <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez sur la carte pour placer le <span className="font-bold text-rose-600">Point B</span>.</p>
          )}
          {distancePoints.length === 2 && mapRef.current && (
            <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">Distance (Vol d'oiseau)</span>
              <span className="text-sm font-black text-rose-700">{(mapRef.current.distance(distancePoints[0], distancePoints[1]) / 1000).toFixed(2)} km</span>
            </div>
          )}
          
          {distancePoints.length > 0 && (
            <button onClick={() => setDistancePoints([])} className="mt-1 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors">
              Nouvelle mesure
            </button>
          )}
        </div>
      )}

      {/* Barre de contrôle supérieure */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-md border border-slate-200 pointer-events-auto">
          <button onClick={() => setCurrentStyle('google-streets')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'google-streets' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><MapIcon className="h-3.5 w-3.5" /><span>Plan</span></button>
          <button onClick={() => setCurrentStyle('google-hybrid')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'google-hybrid' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Compass className="h-3.5 w-3.5" /><span>Sat</span></button>
          <button onClick={() => setCurrentStyle('light-carto')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'light-carto' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Sun className="h-3.5 w-3.5" /><span>Clair</span></button>
          <button onClick={() => setCurrentStyle('dark-carto')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'dark-carto' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Moon className="h-3.5 w-3.5" /><span>Noir</span></button>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button onClick={handleToggleDistance} className={`p-2.5 rounded-xl shadow-md border transition-all cursor-pointer ${isDistanceMode ? 'bg-rose-600 text-white border-rose-700 shadow-rose-600/30' : 'bg-white text-slate-800 hover:text-black hover:bg-slate-50 border-slate-200'}`} title="Mesurer une distance"><Ruler className="h-4.5 w-4.5 stroke-[2.5]" /></button>
          <button onClick={handleToggleRadius} className={`p-2.5 rounded-xl shadow-md border transition-all cursor-pointer ${isRadiusMode ? 'bg-blue-600 text-white border-blue-700 shadow-blue-600/30' : 'bg-white text-slate-800 hover:text-black hover:bg-slate-50 border-slate-200'}`} title="Outil de Mesure par Rayon"><Radar className="h-4.5 w-4.5 stroke-[2.5]" /></button>
          <button 
            onClick={handleLocateMe} 
            className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer" 
            title="Me géolocaliser (Position Rouge)"
          >
            <MapPin className="h-4.5 w-4.5 stroke-[2.5]" />
          </button>
          <button onClick={() => { if(!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }} className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer" title="Plein écran"><Maximize className="h-4.5 w-4.5 stroke-[2.5]" /></button>
        </div>
      </div>

      <div id="leaflet-map-element" ref={containerRef} className="w-full flex-1 min-h-[400px] z-[10]" />

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