/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Etablissement, MapStyle, Specialite } from '../types';
import { Maximize, Compass, MapPin, Map as MapIcon, Sun, Moon, Radar, X, Ruler, ChevronUp, ChevronDown } from 'lucide-react';
import { HEX_PAR_COULEUR, HEX_DEFAUT, SVG_PAR_ICONE, SVG_DEFAUT } from '../config/specialiteVisuels';
import { nomAffichage } from '../utils/nomAffichage';

// Les popups de marqueur sont construites en concaténant des champs venant de la base
// (nom, adresse...) dans une chaîne HTML passée telle quelle à Leaflet — sans échappement,
// un champ contenant du HTML/JS (import CSV, saisie Directus) s'exécuterait dans le
// navigateur de chaque visiteur ouvrant ce marqueur.
const echapperHtml = (valeur: string): string =>
  valeur.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Zoom appliqué quand une ville est sélectionnée (zoomBase en base pour toutes les villes
// actuelles — voir /api/pays). Sert aussi de seuil pour désactiver le clustering carte.
const ZOOM_VILLE = 12;

interface InteractiveMapProps {
  establishments: Etablissement[];
  selectedId: string | null;
  onSelectEstablishment: (establishment: Etablissement) => void;
  center?: [number, number]; // Nouvelles props pour la scalabilité
  zoom?: number;             // Nouvelles props pour la scalabilité
  villeSelectionnee?: boolean;
  specialites: Specialite[];
}

export default function InteractiveMap({
  establishments,
  selectedId,
  onSelectEstablishment,
  center = [33.5731, -7.5898], // Casablanca par défaut
  zoom = 12,
  villeSelectionnee = false,
  specialites
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const layerGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  // Refs pour les outils d'analyse géospatiale
  const radiusLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const distanceLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentStyle, setCurrentStyle] = useState<MapStyle>('google-streets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // État pour stocker la position GPS de l'utilisateur
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // États : Rayon
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [isRadiusCollapsed, setIsRadiusCollapsed] = useState(false); // Widget minimisé
  const [radiusCenter, setRadiusCenter] = useState<L.LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [countInRadius, setCountInRadius] = useState<number | null>(null);

  // États : Distance
  const [isDistanceMode, setIsDistanceMode] = useState(false);
  const [isDistanceCollapsed, setIsDistanceCollapsed] = useState(false); // Widget minimisé
  const [distancePoints, setDistancePoints] = useState<L.LatLng[]>([]);

  // Utilisation de Refs pour synchroniser l'état avec les événements Leaflet sans re-render les marqueurs
  const isRadiusModeRef = useRef(isRadiusMode);
  useEffect(() => { isRadiusModeRef.current = isRadiusMode; }, [isRadiusMode]);

  const isDistanceModeRef = useRef(isDistanceMode);
  useEffect(() => { isDistanceModeRef.current = isDistanceMode; }, [isDistanceMode]);

  // Palette et icônes par catégorie d'établissement, dérivées des spécialités publiées
  // (icone/couleur en base) — plus de liste fermée codée en dur ici.
  const CATEGORY_CONFIG = useMemo(() => {
    const config: Record<string, { color: string; svg: string }> = {};
    for (const s of specialites) {
      config[s.categorieEtablissement] = {
        color: HEX_PAR_COULEUR[s.couleur] ?? HEX_DEFAUT,
        svg: SVG_PAR_ICONE[s.icone] ?? SVG_DEFAUT,
      };
    }
    config['default'] = { color: HEX_DEFAUT, svg: SVG_DEFAUT };
    return config;
  }, [specialites]);

  const TILE_LAYERS = {
    'google-streets': { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' },
    'google-hybrid': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA...' },
    'light-carto': { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' },
    'dark-carto': { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }
  };

  const createSvgIcon = (category: string, isSelected: boolean) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
    const scale = isSelected ? 'scale-125 z-[999]' : 'hover:scale-110';
    const shadow = isSelected ? 'shadow-lg shadow-slate-900/40' : 'shadow-md';

    const html = `
      <div class="relative flex items-center justify-center ${scale} transition-transform duration-200">
        ${isSelected ? `<div class="absolute -inset-2.5 bg-slate-900/20 rounded-full animate-ping duration-1000"></div>` : ''}
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${shadow}" style="background-color: ${config.color}; border: 2px solid #ffffff;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white">${config.svg}</svg>
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
    L.tileLayer(TILE_LAYERS[currentStyle].url, { attribution: TILE_LAYERS[currentStyle].attribution, maxZoom: 19 }).addTo(map);

    // Clustering plutôt qu'un simple layerGroup : sans ville sélectionnée, la carte peut
    // afficher des milliers de marqueurs d'un coup — les créer un par un sans regroupement
    // bloquait le thread principal plusieurs secondes et rendait la carte illisible (pins
    // superposés). disableClusteringAtZoom = ZOOM_VILLE (le zoom utilisé dès qu'une ville
    // est sélectionnée dans le filtre) : à l'échelle pays on garde les bulles, mais dès
    // qu'on est à l'échelle d'une ville — via le sélecteur ou en zoomant sur la carte —
    // tous les établissements individuels s'affichent automatiquement, sans regroupement.
    // maxClusterRadius volontairement réduit : avec un rayon large, une bulle pouvait
    // regrouper plusieurs villes proches (ex. Rabat+Salé), et zoomToBoundsOnClick devait
    // alors zoomer moins fort pour garder tout ce contenu visible — laissant des
    // sous-bulles après un premier clic. Un rayon serré permet à la quasi-totalité des
    // bulles de se disperser entièrement en un clic (testé empiriquement : bulles OK
    // partout sauf la plus grosse). Casablanca (~1500+ établissements sur une zone
    // réellement large) reste une exception assumée : aucun réglage de rayon ne peut
    // faire tenir "tout visible" et "assez zoomé pour ne plus regrouper" en un seul clic
    // pour une zone aussi étendue — zoomToBoundsOnClick garantit qu'on ne voit jamais un
    // écran vide, au prix d'un clic supplémentaire pour ce cas précis.
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 12,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: ZOOM_VILLE,
    });
    clusterGroup.addTo(map);
    layerGroupRef.current = clusterGroup;
    radiusLayerGroupRef.current = L.layerGroup().addTo(map);
    distanceLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocationLayerGroupRef.current = L.layerGroup().addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { mapRef.current?.flyTo(center, zoom, { animate: true, duration: 1.5 }); }, [center, zoom]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    L.tileLayer(TILE_LAYERS[currentStyle].url, { attribution: TILE_LAYERS[currentStyle].attribution, maxZoom: 19 }).addTo(map);
  }, [currentStyle]);

  // Recalcule la taille de la carte après un changement plein écran (bug Leaflet connu sinon).
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => { mapRef.current?.invalidateSize(); }, 200);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => { document.removeEventListener('fullscreenchange', handleFsChange); };
  }, []);

  // Affichage de la localisation utilisateur avec Capture d'événements
  useEffect(() => {
    const map = mapRef.current;
    const uGroup = userLocationLayerGroupRef.current;
    if (!map || !uGroup) return;

    uGroup.clearLayers();
    if (userLocation) {
      const html = `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-3 bg-red-500/40 rounded-full animate-ping duration-1000"></div>
          <div class="relative flex items-center justify-center w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-lg shadow-red-900/50">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `;
      const userIcon = L.divIcon({ className: 'custom-user-marker', html: html, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12] });
      const marker = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 });

      marker.bindPopup(`<div class="text-center p-2"><div class="text-[11px] text-slate-800 font-black tracking-wide">Vous êtes ici</div></div>`, { className: 'custom-leaflet-popup', closeButton: false });

      // CAPTURE DU CLIC : Permet de cibler l'utilisateur pour le Rayon et la Distance
      marker.on('click', (e) => {
        if (isRadiusModeRef.current || isDistanceModeRef.current) {
          map.closePopup();
          if (isRadiusModeRef.current) setRadiusCenter(e.latlng);
          if (isDistanceModeRef.current) setDistancePoints(prev => prev.length === 2 ? [e.latlng] : [...prev, e.latlng]);
        }
      });

      uGroup.addLayer(marker);
      setTimeout(() => marker.openPopup(), 400);
    }
  }, [userLocation]);

  // Clic sur l'espace vide de la carte
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (isRadiusMode) setRadiusCenter(e.latlng);
      else if (isDistanceMode) setDistancePoints(prev => prev.length === 2 ? [e.latlng] : [...prev, e.latlng]);
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
    return () => { map.off('click', onMapClick); map.getContainer().style.cursor = ''; };
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
      rGroup.addLayer(L.circle(radiusCenter, { radius: radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }));
      const centerMarker = L.circleMarker(radiusCenter, { radius: 6, color: '#1e3a8a', fillColor: '#ffffff', fillOpacity: 1, weight: 3 });

      let count = 0;
      establishments.forEach(e => { if (map.distance(radiusCenter, L.latLng(e.latitude, e.longitude)) <= radiusMeters) count++; });
      setCountInRadius(count);

      centerMarker.bindPopup(`<div class="text-center p-2"><div class="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Zone d'Impact</div><div class="text-xs text-slate-800 font-black mb-2">Rayon : ${radiusKm} km</div><div class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-200 shadow-sm">${count} résultat(s)</div></div>`, { closeButton: false, className: 'radius-popup' }).openPopup();
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
        line.bindTooltip(`${(map.distance(p1, p2) / 1000).toFixed(2)} km`, { permanent: true, direction: 'center', className: 'font-black text-sm bg-white border border-rose-200 px-2 py-1 rounded shadow-sm text-rose-600' });
        dGroup.addLayer(line);
      }
    }
  }, [isDistanceMode, distancePoints]);

  // Affichage des établissements avec Capture d'événements
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markersRef.current = {};

    if (establishments.length === 0) return;
    const bounds: L.LatLngTuple[] = [];
    const nouveauxMarqueurs: L.Marker[] = [];

    establishments.forEach((etab) => {
      const marker = L.marker([etab.latitude, etab.longitude], { icon: createSvgIcon(etab.categorie, etab.id === selectedId) });

      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${etab.latitude},${etab.longitude}&query_place_id=${encodeURIComponent(etab.placeId)}`;
      const categorie = echapperHtml(etab.categorie);
      const source = echapperHtml(etab.source);
      const nom = echapperHtml(nomAffichage(etab.nom));
      const quartierOuArrondissement = echapperHtml(etab.quartier || etab.arrondissement);
      const ville = echapperHtml(etab.ville);
      const adresse = echapperHtml(etab.adresse);
      const popupHtml = `
        <div class="p-4 font-sans min-w-[220px]" style="line-height: 1.4;">
          <div class="flex items-center justify-between gap-2 mb-2 border-b border-slate-200 pb-2">
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">${categorie}</span>
            <span class="text-[9px] text-slate-400 font-bold uppercase">${source}</span>
          </div>
          <h4 class="text-xs font-black text-slate-900 mb-1 leading-tight tracking-tight">${nom}</h4>
          <p class="text-[10px] text-slate-500 mb-3 flex items-start gap-1 font-semibold">
            <svg class="h-3 w-3 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>${quartierOuArrondissement}, ${ville}</span>
          </p>
          <div class="flex flex-col gap-1 text-[9px] text-slate-400 bg-slate-50 border border-slate-200 p-2 rounded-lg mb-3">
            <div><strong class="text-slate-700 font-bold uppercase text-[8px] tracking-wider">Adresse:</strong> ${adresse}</div>
            <div class="flex justify-between mt-1.5 pt-1.5 border-t border-slate-200 font-semibold">
              <span>GPS: ${etab.latitude.toFixed(4)}, ${etab.longitude.toFixed(4)}</span>
            </div>
          </div>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 px-2 rounded-lg text-[9px] uppercase tracking-wider shadow-sm transition-colors no-underline">
            Ouvrir Google Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260, className: 'custom-leaflet-popup' });

      // CAPTURE DU CLIC SUR UN ÉTABLISSEMENT
      marker.on('click', (e) => {
        if (isRadiusModeRef.current || isDistanceModeRef.current) {
          map.closePopup(); // Referme la popup par défaut si l'outil est actif
          if (isRadiusModeRef.current) setRadiusCenter(e.latlng);
          if (isDistanceModeRef.current) setDistancePoints(prev => prev.length === 2 ? [e.latlng] : [...prev, e.latlng]);
        } else {
          onSelectEstablishment(etab);
        }
      });

      markersRef.current[etab.id] = marker;
      nouveauxMarqueurs.push(marker);
      bounds.push([etab.latitude, etab.longitude]);
    });

    // addLayers() (au pluriel) ajoute tous les marqueurs en un seul passage de reclustering,
    // au lieu de recalculer l'arbre de clusters à chaque addLayer() individuel — c'était la
    // cause d'un délai de ~28s entre la fin du chargement et l'affichage du premier marqueur
    // sur de gros volumes (mesuré en prod avant ce correctif).
    layerGroup.addLayers(nouveauxMarqueurs);

    // Une fois une ville sélectionnée, le zoom cible (ZOOM_VILLE, sous le seuil de
    // déclustering) est déjà géré par l'effet [center, zoom] ci-dessous — fitBounds
    // recalculerait sa propre valeur pour englober tous les établissements de la ville
    // avec sa marge, ce qui peut redescendre sous ZOOM_VILLE et réactiver le clustering.
    if (villeSelectionnee || selectedId) return;

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    }
  }, [establishments, CATEGORY_CONFIG, villeSelectionnee, selectedId]);

  // Focus externe
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = layerGroupRef.current;
    if (!map || !clusterGroup || !selectedId || !markersRef.current[selectedId]) return;
    const marker = markersRef.current[selectedId];
    establishments.forEach((e) => { if (markersRef.current[e.id]) markersRef.current[e.id].setIcon(createSvgIcon(e.categorie, e.id === selectedId)); });
    // Un marqueur "avalé" dans un cluster n'est pas ajouté au DOM tant qu'on ne dézoome/spiderfy
    // pas dessus — un simple flyTo() + openPopup() ne l'affichait donc pas pour les établissements
    // regroupés (bug remonté par l'utilisateur). zoomToShowLayer gère ce dé-clustering avant
    // d'ouvrir la popup, quel que soit le niveau de zoom de départ.
    clusterGroup.zoomToShowLayer(marker, () => { marker.openPopup(); });
  }, [selectedId]);

  // Toggles intelligents
  const handleToggleRadius = () => {
    setIsRadiusMode(!isRadiusMode);
    setIsRadiusCollapsed(false); // S'assure qu'il est ouvert
    if (!isRadiusMode) setIsDistanceMode(false);
  };

  const handleToggleDistance = () => {
    setIsDistanceMode(!isDistanceMode);
    setIsDistanceCollapsed(false); // S'assure qu'il est ouvert
    if (!isDistanceMode) setIsRadiusMode(false);
  };

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) { alert("La géolocalisation n'est pas supportée."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        map.flyTo([position.coords.latitude, position.coords.longitude], 15, { duration: 1.5 });
      },
      () => { map.flyTo(center, zoom, { duration: 1.5 }); }
    );
  };

  // Génération dynamique de la légende
  const activeCategories = useMemo(() => {
    const uniqueCats = Array.from(new Set(establishments.map(e => e.categorie)));
    return uniqueCats.map(cat => ({
      name: cat,
      color: CATEGORY_CONFIG[cat]?.color || CATEGORY_CONFIG['default'].color
    }));
  }, [establishments, CATEGORY_CONFIG]);

  return (
    <div className="relative w-full h-full min-h-[450px] lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col bg-slate-100">

      {/* WIDGET RAYON (Draggable/Minimizable en haut à droite) */}
      {isRadiusMode && (
        <div className={`absolute top-20 right-4 z-[2000] bg-white/95 backdrop-blur-md rounded-2xl border border-blue-200 shadow-xl pointer-events-auto flex flex-col transition-all overflow-hidden ${isRadiusCollapsed ? 'w-auto p-2.5' : 'p-4 min-w-[280px] gap-3'}`}>
          <div className={`flex justify-between items-center ${isRadiusCollapsed ? '' : 'border-b border-slate-100 pb-2'}`}>
            <div className="flex items-center gap-2 text-blue-700 pr-6">
              <Radar className="h-4 w-4 stroke-[2.5]" />
              <span className="text-[10px] font-black uppercase tracking-widest">{isRadiusCollapsed ? 'Rayon' : 'Analyse par Rayon'}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setIsRadiusCollapsed(!isRadiusCollapsed)} className="text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 rounded-lg p-1 transition-colors">
                {isRadiusCollapsed ? <ChevronDown className="h-4 w-4 stroke-[3]" /> : <ChevronUp className="h-4 w-4 stroke-[3]" />}
              </button>
              <button onClick={() => setIsRadiusMode(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-lg p-1 transition-colors">
                <X className="h-4 w-4 stroke-[3]" />
              </button>
            </div>
          </div>

          {!isRadiusCollapsed && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase flex justify-between">
                  <span>Distance du rayon</span><span className="text-blue-700 font-black">{radiusKm} km</span>
                </label>
                <input type="range" min="1" max="50" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
              {!radiusCenter ? (
                <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez sur la carte ou sur un marqueur.</p>
              ) : (
                <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Ciblés</span>
                  <span className="text-sm font-black text-blue-700">{countInRadius ?? 0}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* WIDGET DISTANCE (Draggable/Minimizable en haut à droite) */}
      {isDistanceMode && (
        <div className={`absolute top-20 right-4 z-[2000] bg-white/95 backdrop-blur-md rounded-2xl border border-rose-200 shadow-xl pointer-events-auto flex flex-col transition-all overflow-hidden ${isDistanceCollapsed ? 'w-auto p-2.5' : 'p-4 min-w-[280px] gap-3'}`}>
          <div className={`flex justify-between items-center ${isDistanceCollapsed ? '' : 'border-b border-slate-100 pb-2'}`}>
            <div className="flex items-center gap-2 text-rose-700 pr-6">
              <Ruler className="h-4 w-4 stroke-[2.5]" />
              <span className="text-[10px] font-black uppercase tracking-widest">{isDistanceCollapsed ? 'Distance' : 'Mesure de Distance'}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setIsDistanceCollapsed(!isDistanceCollapsed)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-lg p-1 transition-colors">
                {isDistanceCollapsed ? <ChevronDown className="h-4 w-4 stroke-[3]" /> : <ChevronUp className="h-4 w-4 stroke-[3]" />}
              </button>
              <button onClick={() => setIsDistanceMode(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-lg p-1 transition-colors">
                <X className="h-4 w-4 stroke-[3]" />
              </button>
            </div>
          </div>

          {!isDistanceCollapsed && (
            <>
              {distancePoints.length === 0 && <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez sur la carte ou une clinique pour placer le Point A.</p>}
              {distancePoints.length === 1 && <p className="text-[10px] font-semibold text-slate-500 text-center italic bg-slate-50 border border-slate-100 p-2 rounded-lg">Cliquez pour placer le Point B.</p>}
              {distancePoints.length === 2 && mapRef.current && (
                <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">Distance Vol d'oiseau</span>
                  <span className="text-sm font-black text-rose-700">{(mapRef.current.distance(distancePoints[0], distancePoints[1]) / 1000).toFixed(2)} km</span>
                </div>
              )}
              {distancePoints.length > 0 && (
                <button onClick={() => setDistancePoints([])} className="mt-1 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors">Nouvelle mesure</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Barre de contrôle supérieure (Fonds de cartes + Outils) */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-md border border-slate-200 pointer-events-auto">
          <button onClick={() => setCurrentStyle('google-streets')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${currentStyle === 'google-streets' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <MapIcon className="h-3.5 w-3.5" /><span>Plan</span>
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

        <div className="flex gap-2 pointer-events-auto ml-auto">
          <button onClick={handleToggleDistance} className={`p-2.5 rounded-xl shadow-md border transition-all cursor-pointer ${isDistanceMode ? 'bg-rose-600 text-white border-rose-700 shadow-rose-600/30' : 'bg-white text-slate-800 hover:text-black hover:bg-slate-50 border-slate-200'}`} title="Mesurer une distance"><Ruler className="h-4.5 w-4.5 stroke-[2.5]" /></button>
          <button onClick={handleToggleRadius} className={`p-2.5 rounded-xl shadow-md border transition-all cursor-pointer ${isRadiusMode ? 'bg-blue-600 text-white border-blue-700 shadow-blue-600/30' : 'bg-white text-slate-800 hover:text-black hover:bg-slate-50 border-slate-200'}`} title="Outil de Mesure par Rayon"><Radar className="h-4.5 w-4.5 stroke-[2.5]" /></button>
          <button onClick={handleLocateMe} className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer" title="Me géolocaliser"><MapPin className="h-4.5 w-4.5 stroke-[2.5]" /></button>
          <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }} className="p-2.5 bg-white text-slate-800 hover:text-black hover:bg-slate-50 rounded-xl shadow-md border border-slate-200 transition-all cursor-pointer hidden sm:block" title="Plein écran"><Maximize className="h-4.5 w-4.5 stroke-[2.5]" /></button>
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
