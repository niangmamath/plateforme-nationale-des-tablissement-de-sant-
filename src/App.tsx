/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import ScoringSection from './components/ScoringSection';
import ChatbotWidget from './components/ChatbotWidget';
import React, { useState, useMemo, useEffect } from 'react';
import { computeKpis } from './data/etablissements';
import { Etablissement, FilterState, PaysGeo, Specialite, VilleGeo } from './types';
import KpiSection from './components/KpiSection';
import FilterSection from './components/FilterSection';
import SidebarList from './components/SidebarList';
import InteractiveMap from './components/InteractiveMap';
import StatsDashboard from './components/StatsDashboard';
import { Activity, Plus, Database, Info, Heart } from 'lucide-react';

export default function App() {
  // Données chargées depuis l'API (Postgres)
  const [countries, setCountries] = useState<PaysGeo[]>([]);
  const [baseEstablishments, setBaseEstablishments] = useState<Etablissement[]>([]);
  const [specialites, setSpecialites] = useState<Specialite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/pays').then((r) => r.json()),
      fetch('/api/etablissements').then((r) => r.json()),
      fetch('/api/specialites').then((r) => r.json()),
    ])
      .then(([paysData, etabsData, specialitesData]: [PaysGeo[], Etablissement[], Specialite[]]) => {
        setCountries(paysData);
        setBaseEstablishments(etabsData);
        setSpecialites(specialitesData);
      })
      .catch(() => setLoadError("Impossible de charger les données depuis l'API."))
      .finally(() => setIsLoading(false));
  }, []);

  // Current active filtered state
  const [selectedCountry, setSelectedCountry] = useState<PaysGeo | null>(null);
  const [selectedCity, setSelectedCity] = useState<VilleGeo | null>(null);

  useEffect(() => {
    if (countries.length > 0 && !selectedCountry) {
      setSelectedCountry(countries[0]); // Maroc par défaut
      // selectedCity reste null : "toutes les villes" du pays par défaut
    }
  }, [countries, selectedCountry]);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    ville: '',
    quartier: '',
    categorie: [],
    source: ''
  });

  // Quand on change de pays ou de ville, les anciens filtres (ville/quartier) n'ont plus de sens
  useEffect(() => {
    setFilters((prev) => ({ ...prev, ville: '', quartier: '' }));
  }, [selectedCountry, selectedCity]);

  // Track currently highlighted/selected establishment
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Établissements du périmètre actuellement sélectionné (via le sélecteur global en haut de page) :
  // une ville précise si elle est choisie, sinon tout le pays. C'est ce périmètre qui alimente
  // tout le reste de la page (annuaire, carte, KPIs, stats).
  const scopedEstablishments = useMemo(() => {
    if (!selectedCountry) return [];
    if (selectedCity) {
      return baseEstablishments.filter((e) => e.ville === selectedCity.nom);
    }
    const villesDuPays = new Set(selectedCountry.villes.map((v) => v.nom));
    return baseEstablishments.filter((e) => villesDuPays.has(e.ville));
  }, [baseEstablishments, selectedCountry, selectedCity]);

  // Compute unique filter options dynamically based on the active dataset
  const uniqueVilles = useMemo(() => {
    return Array.from(new Set(scopedEstablishments.map(e => e.ville))).sort();
  }, [scopedEstablishments]);

  // Compute unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(scopedEstablishments.map(e => e.categorie))).sort();
  }, [scopedEstablishments]);

  // Compute unique sources
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(scopedEstablishments.map(e => e.source))).sort();
  }, [scopedEstablishments]);

  // Compute neighborhoods conditioned on selected city
  const uniqueQuartiers = useMemo(() => {
    if (!filters.ville) {
      return Array.from(new Set(scopedEstablishments.map(e => e.quartier))).sort();
    }
    return Array.from(new Set(scopedEstablishments.filter(e => e.ville === filters.ville).map(e => e.quartier))).sort();
  }, [scopedEstablishments, filters.ville]);

  // Filter the list of establishments based on FilterState
  const filteredEstablishments = useMemo(() => {
    return scopedEstablishments.filter((etab) => {
      // Text Search: match name, address, category or neighborhood
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = etab.nom.toLowerCase().includes(query);
        const matchesAddress = etab.adresse.toLowerCase().includes(query);
        const matchesQuartier = etab.quartier.toLowerCase().includes(query);
        const matchesSpeciality = etab.categorie.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesQuartier && !matchesSpeciality) {
          return false;
        }
      }

      // Ville Filter
      if (filters.ville && etab.ville !== filters.ville) return false;
      // Quartier Filter
      if (filters.quartier && etab.quartier !== filters.quartier) return false;
      // Categorie Filter
      if (filters.categorie.length > 0 && !filters.categorie.includes(etab.categorie)) return false;
      // Source Filter
      if (filters.source && etab.source !== filters.source) return false;

      return true;
    });
  }, [scopedEstablishments, filters]);

  // Calculate dashboard indicators dynamically
  const kpis = useMemo(() => {
    return computeKpis(filteredEstablishments);
  }, [filteredEstablishments]);

  // Centre approximatif du pays (moyenne des villes) pour recentrer la carte quand
  // aucune ville précise n'est sélectionnée ("Toutes les villes").
  const countryCenter = useMemo((): [number, number] => {
    if (!selectedCountry || selectedCountry.villes.length === 0) return [33.5731, -7.5898];
    const lat = selectedCountry.villes.reduce((sum, v) => sum + v.lat, 0) / selectedCountry.villes.length;
    const lng = selectedCountry.villes.reduce((sum, v) => sum + v.lng, 0) / selectedCountry.villes.length;
    return [lat, lng];
  }, [selectedCountry]);

  // Zones à plat (tous pays confondus) pour l'onglet Démographie de StatsDashboard —
  // remplace l'ancien tableau ARRONDISSEMENTS_DEMO codé en dur (Maroc uniquement).
  const allZones = useMemo(() => {
    return countries.flatMap((pays) =>
      pays.villes.flatMap((ville) =>
        ville.zones.map((zone) => ({
          nom: zone.nom,
          ville: ville.nom,
          population: zone.population,
          densite: zone.densite ?? 0,
          pop15_59: zone.pop15_59 ?? 0,
          pop60_plus: zone.pop60_plus ?? 0,
          prixM2: zone.prixM2,
        }))
      )
    );
  }, [countries]);

  // Interaction: When clicking on sidebar list card
  const handleSelectEstablishment = (establishment: Etablissement) => {
    setSelectedId(establishment.id);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-700 font-bold text-sm">
        {loadError}
      </div>
    );
  }

  if (isLoading || !selectedCountry) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold text-sm uppercase tracking-wider">
        Chargement des données...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-50 via-blue-50/40 to-slate-100 text-slate-800 font-sans selection:bg-blue-600 selection:text-white pb-12">

      {/* Modern High-End Top Bar / Navigation */}
      <header className="sticky top-0 z-[1010] bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-4 md:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Logo Brand / Identity */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight mt-1 uppercase">
                Empower Doctor
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 flex flex-col gap-6">
        
        {/* Filters Panel */}
        <section id="filters-section">
          <FilterSection
            filters={filters}
            setFilters={setFilters}
            categories={uniqueCategories}
            sources={uniqueSources}
            countries={countries}
            selectedCountry={selectedCountry}
            selectedCity={selectedCity}
            onCountryChange={setSelectedCountry}
            onCityChange={setSelectedCity}
          />
        </section>

        {/* Dynamic KPIs Block */}
        <section id="kpis-section">
          <KpiSection kpis={kpis} establishments={filteredEstablishments} specialites={specialites} />
        </section>

        {/* Informative Note banner */}
        <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-3 text-xs text-blue-900 font-medium shadow-sm">
          <div className="p-1.5 bg-white rounded-lg text-blue-600 shadow-sm border border-blue-100/50">
            <Info className="h-4 w-4 stroke-[2.5]" />
          </div>
          <p className="leading-relaxed uppercase text-[10px] tracking-wide text-slate-600">
            <strong className="text-blue-800 font-black">Conseil :</strong> Cliquez sur un établissement dans le panneau latéral pour recentrer la carte instantanément et afficher son itinéraire.
          </p>
        </div>

        {/* Spatial Geospatial Core Section (Map + Sidebar) */}
        <section id="geospatial-core" className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* Left panel: Interactive Sidebar List (approx 30% / 4 cols) */}
          <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-[600px] rounded-2xl shadow-sm">
            <SidebarList
              establishments={filteredEstablishments}
              selectedId={selectedId}
              onSelectEstablishment={handleSelectEstablishment}
              specialites={specialites}
            />
          </div>

          {/* Right panel: Grand Interactive Map (approx 70% / 8 cols) */}
          <div className="lg:col-span-8 h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <InteractiveMap
              establishments={filteredEstablishments}
              selectedId={selectedId}
              onSelectEstablishment={handleSelectEstablishment}
              center={selectedCity ? [selectedCity.lat, selectedCity.lng] : countryCenter}
              zoom={selectedCity ? selectedCity.zoomBase : 6}
              specialites={specialites}
            />
          </div>
        </section>

        {/* Advanced Statistical & Distribution Dashboards */}
        <section id="analytics-section">
          <StatsDashboard establishments={filteredEstablishments} zones={allZones} />
        </section>

        {/* LA NOUVELLE SECTION DE SCORING EST ICI */}
        <section id="scoring-section" className="mt-8">
          <ScoringSection
            villes={selectedCountry.villes}
            etablissements={baseEstablishments}
            initialVilleId={selectedCity?.id}
            currency={selectedCountry.devise}
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200/80 pt-8 pb-4 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-[10px] font-black uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-slate-400" />
            <span>Architecture PostGIS préréglée. Mode actuel : Simulation.</span>
          </div>
          <div>
            <span>© 2026 Ministère de la Santé - {selectedCountry.nom}. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Développé pour la</span>
            <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            <span>Cartographie Sanitaire</span>
          </div>
        </div>
      </footer>
      <ChatbotWidget />
    </div>
  );
}