/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AVAILABLE_COUNTRIES } from './data';
import GlobalLocationSelector from './components/GlobalLocationSelector';
import ScoringSection from './components/ScoringSection';
import ChatbotWidget from './components/ChatbotWidget';
import React, { useState, useMemo } from 'react';
import { ESTABLISHMENTS_DATA, VILLES, CATEGORIES, SOURCES, getQuartiersByVille, computeKpis } from './data/etablissements';
import { Etablissement, FilterState } from './types';
import KpiSection from './components/KpiSection';
import FilterSection from './components/FilterSection';
import SidebarList from './components/SidebarList';
import InteractiveMap from './components/InteractiveMap';
import StatsDashboard from './components/StatsDashboard';
import { motion } from 'motion/react';
import { Activity, Plus, Upload, Download, Database, CheckCircle, Info, Heart } from 'lucide-react';

export default function App() {
  // Current active filtered state
  const [selectedCountry, setSelectedCountry] = useState(AVAILABLE_COUNTRIES[0]); // Maroc par défaut
  const [selectedCity, setSelectedCity] = useState(AVAILABLE_COUNTRIES[0].villes[0]); // Casablanca par défaut
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    ville: '',
    quartier: '',
    categorie: '',
    source: ''
  });

  // Track currently highlighted/selected establishment
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dynamic state for custom added establishments (Excel import simulation)
  const [customEtablissements, setCustomEtablissements] = useState<Etablissement[]>([]);
  const [showImportToast, setShowImportToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Combined full dataset
  const allEstablishments = useMemo(() => {
    return [...ESTABLISHMENTS_DATA, ...customEtablissements];
  }, [customEtablissements]);

  // Compute unique filter options dynamically based on the active dataset
  const uniqueVilles = useMemo(() => {
    return Array.from(new Set(allEstablishments.map(e => e.ville))).sort();
  }, [allEstablishments]);

  // Compute unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(allEstablishments.map(e => e.categorie))).sort();
  }, [allEstablishments]);

  // Compute unique sources
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(allEstablishments.map(e => e.source))).sort();
  }, [allEstablishments]);

  // Compute neighborhoods conditioned on selected city
  const uniqueQuartiers = useMemo(() => {
    if (!filters.ville) {
      return Array.from(new Set(allEstablishments.map(e => e.quartier))).sort();
    }
    return Array.from(new Set(allEstablishments.filter(e => e.ville === filters.ville).map(e => e.quartier))).sort();
  }, [allEstablishments, filters.ville]);

  // Filter the list of establishments based on FilterState
  const filteredEstablishments = useMemo(() => {
    return allEstablishments.filter((etab) => {
      // Text Search: match name, address, category or neighborhood
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = etab.nom.toLowerCase().includes(query);
        const matchesAddress = etab.adresse.toLowerCase().includes(query);
        const matchesQuartier = etab.quartier.toLowerCase().includes(query);
        const matchesSpeciality = etab.specialites?.some(s => s.toLowerCase().includes(query)) || false;
        if (!matchesName && !matchesAddress && !matchesQuartier && !matchesSpeciality) {
          return false;
        }
      }

      // Ville Filter
      if (filters.ville && etab.ville !== filters.ville) return false;
      // Quartier Filter
      if (filters.quartier && etab.quartier !== filters.quartier) return false;
      // Categorie Filter
      if (filters.categorie && etab.categorie !== filters.categorie) return false;
      // Source Filter
      if (filters.source && etab.source !== filters.source) return false;

      return true;
    });
  }, [allEstablishments, filters]);

  // Calculate dashboard indicators dynamically
  const kpis = useMemo(() => {
    return computeKpis(filteredEstablishments);
  }, [filteredEstablishments]);

  // Interaction: When clicking on sidebar list card
  const handleSelectEstablishment = (establishment: Etablissement) => {
    setSelectedId(establishment.id);
  };

  // Simulation: Simulated Excel file import
  const handleExcelImportSimulation = () => {
    const citiesList = ["Rabat", "Casablanca", "Marrakech"];
    const chosenCity = citiesList[Math.floor(Math.random() * citiesList.length)];
    let lat = 34.0045;
    let lng = -6.8495;
    let neighborhood = "Agdal";

    if (chosenCity === "Casablanca") {
      lat = 33.58 + (Math.random() - 0.5) * 0.05;
      lng = -7.62 + (Math.random() - 0.5) * 0.05;
      neighborhood = "Maârif";
    } else if (chosenCity === "Marrakech") {
      lat = 31.63 + (Math.random() - 0.5) * 0.05;
      lng = -8.01 + (Math.random() - 0.5) * 0.05;
      neighborhood = "Guéliz";
    } else {
      lat = 34.00 + (Math.random() - 0.5) * 0.05;
      lng = -6.84 + (Math.random() - 0.5) * 0.05;
      neighborhood = "Hay Riad";
    }

    // Corrigé pour ne générer que les catégories valides
    const categoriesList = ["Clinique Privée", "Ophtalmologie"];
    const chosenCat = categoriesList[Math.floor(Math.random() * categoriesList.length)];

    const id = `sim-${Date.now()}`;
    const newRecord: Etablissement = {
      id,
      nom: `${chosenCat === "Clinique Privée" ? "Clinique Spécialisée" : "Cabinet d'Ophtalmologie"} Al Shifa (${chosenCity})`,
      categorie: chosenCat,
      ville: chosenCity,
      quartier: neighborhood,
      adresse: `Boulevard Mohammed V, Secteur ${Math.floor(Math.random() * 20) + 1}, ${neighborhood}, ${chosenCity}`,
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lng.toFixed(4)),
      source: "Import Excel (Simulation)",
      placeId: `ChIJ${Math.random().toString(36).substring(2, 12)}`,
      telephone: "+212 537-889900",
      rating: Number((4.0 + Math.random()).toFixed(1)),
      reviewsCount: Math.floor(Math.random() * 50) + 10,
      status: "Ouvert",
      specialites: ["Consultation d'urgence", "Soins Généraux"]
    };

    setCustomEtablissements(prev => [newRecord, ...prev]);
    setToastMessage(`Import réussi : "${newRecord.nom}" ajouté à ${newRecord.ville} !`);
    setShowImportToast(true);
    setTimeout(() => setShowImportToast(false), 5000);

    setTimeout(() => {
      setSelectedId(id);
    }, 400);
  };

  // Simulation: Simulated Excel file export
  const handleExcelExport = () => {
    const headers = ["Nom", "Catégorie", "Ville", "Quartier", "Adresse", "Latitude", "Longitude", "Source", "Place_ID"];
    const rows = filteredEstablishments.map(e => [
      e.nom, e.categorie, e.ville, e.quartier, e.adresse, e.latitude, e.longitude, e.source, e.placeId
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `etablissements_sante_maroc_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage(`Export Excel réussi : ${filteredEstablishments.length} établissements téléchargés.`);
    setShowImportToast(true);
    setTimeout(() => setShowImportToast(false), 4000);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-50 via-blue-50/40 to-slate-100 text-slate-800 font-sans selection:bg-blue-600 selection:text-white pb-12">
      
      {/* LA NOUVELLE BARRE GLOBALE DE SÉLECTION PAYS / VILLE */}
      <GlobalLocationSelector 
        countries={AVAILABLE_COUNTRIES}
        selectedCountry={selectedCountry}
        selectedCity={selectedCity}
        onCountryChange={setSelectedCountry}
        onCityChange={setSelectedCity}
      />



      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[2000] pointer-events-none">
        {showImportToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-2xl shadow-blue-900/20 p-4 max-w-sm flex items-start gap-3 border border-slate-800"
          >
            <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Notification Plateforme</h4>
              <p className="text-[11px] font-medium text-slate-300 mt-0.5 leading-relaxed">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modern High-End Top Bar / Navigation */}
      <header className="sticky top-0 z-[1010] bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-4 md:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Logo Brand / Identity */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/50">Royaume du Maroc</span>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/50">Casablanca et Fès</span>
              </div>
              <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight mt-1 uppercase">
                Plateforme Nationale des Établissements de Santé
              </h1>
            </div>
          </div>

          {/* SaaS Simulation Controls */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="btn-excel-import"
              onClick={handleExcelImportSimulation}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Simuler l'intégration d'un fichier Excel"
            >
              <Upload className="h-4 w-4 stroke-[2.5]" />
              <span>Importer</span>
            </button>
            
            <button
              id="btn-excel-export"
              onClick={handleExcelExport}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/25 active:scale-95"
              title="Télécharger l'état actuel au format Excel/CSV"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 flex flex-col gap-6">
        
        {/* Dynamic KPIs Block */}
        <section id="kpis-section">
          <KpiSection kpis={kpis} />
        </section>

        {/* Filters Panel */}
        <section id="filters-section">
          <FilterSection
            filters={filters}
            setFilters={setFilters}
            categories={uniqueCategories}
            sources={uniqueSources}
            
          />
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
            />
          </div>

          {/* Right panel: Grand Interactive Map (approx 70% / 8 cols) */}
          <div className="lg:col-span-8 h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <InteractiveMap
              establishments={filteredEstablishments}
              selectedId={selectedId}
              onSelectEstablishment={handleSelectEstablishment}
            />
          </div>
        </section>

        {/* Advanced Statistical & Distribution Dashboards */}
        <section id="analytics-section">
          <StatsDashboard establishments={filteredEstablishments} />
        </section>

        {/* LA NOUVELLE SECTION DE SCORING EST ICI */}
        <section id="scoring-section" className="mt-8">
          <ScoringSection 
            villeName={selectedCity.nom} 
            zones={selectedCity.zones} 
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
            <span>© 2026 Ministère de la Santé - Royaume du Maroc. Tous droits réservés.</span>
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