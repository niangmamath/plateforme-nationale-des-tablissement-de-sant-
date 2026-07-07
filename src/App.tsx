/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ESTABLISHMENTS_DATA, VILLES, CATEGORIES, SOURCES, getQuartiersByVille, computeKpis } from './data/etablissements';
import { Etablissement, FilterState } from './types';
import KpiSection from './components/KpiSection';
import FilterSection from './components/FilterSection';
import SidebarList from './components/SidebarList';
import InteractiveMap from './components/InteractiveMap';
import StatsDashboard from './components/StatsDashboard';
import { motion } from 'motion/react';
import { Activity, FileSpreadsheet, Plus, Upload, Download, Database, CheckCircle, Info, Heart } from 'lucide-react';

export default function App() {
  // Current active filtered state
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
      if (filters.ville && etab.ville !== filters.ville) {
        return false;
      }

      // Quartier Filter
      if (filters.quartier && etab.quartier !== filters.quartier) {
        return false;
      }

      // Categorie Filter
      if (filters.categorie && etab.categorie !== filters.categorie) {
        return false;
      }

      // Source Filter
      if (filters.source && etab.source !== filters.source) {
        return false;
      }

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

    const categoriesList = ["Clinique", "Ophtalmologue", "Cabinet Médical"];
    const chosenCat = categoriesList[Math.floor(Math.random() * categoriesList.length)];

    const id = `sim-${Date.now()}`;
    const newRecord: Etablissement = {
      id,
      nom: `${chosenCat === "Clinique" ? "Clinique Spécialisée" : chosenCat === "Ophtalmologue" ? "Cabinet d'Ophtalmologie" : "Centre Médical"} Al Shifa (${chosenCity})`,
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
      horaires: "09:00 - 18:00",
      specialites: ["Consultation d'urgence", "Soins Généraux"]
    };

    setCustomEtablissements(prev => [newRecord, ...prev]);
    setToastMessage(`Fichier Excel importé avec succès : 1 nouvel établissement "${newRecord.nom}" ajouté à ${newRecord.ville} !`);
    setShowImportToast(true);
    setTimeout(() => setShowImportToast(false), 5000);

    // Auto focus on the imported node
    setTimeout(() => {
      setSelectedId(id);
    }, 400);
  };

  // Simulation: Simulated Excel file export
  const handleExcelExport = () => {
    const headers = ["Nom", "Catégorie", "Ville", "Quartier", "Adresse", "Latitude", "Longitude", "Source", "Place_ID"];
    const rows = filteredEstablishments.map(e => [
      e.nom,
      e.categorie,
      e.ville,
      e.quartier,
      e.adresse,
      e.latitude,
      e.longitude,
      e.source,
      e.placeId
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

    setToastMessage(`Export Excel réussi : ${filteredEstablishments.length} établissements téléchargés au format CSV.`);
    setShowImportToast(true);
    setTimeout(() => setShowImportToast(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans selection:bg-slate-900 selection:text-white pb-12">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[2000] pointer-events-none">
        {showImportToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl p-4 max-w-sm flex items-start gap-3 border-2 border-slate-950"
          >
            <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Notification Plateforme</h4>
              <p className="text-[11px] font-bold text-slate-300 mt-0.5 leading-relaxed">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modern High-End Top Bar / Navigation */}
      <header className="sticky top-0 z-[1010] bg-white/95 backdrop-blur-md border-b-2 border-slate-900 px-4 py-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Logo Brand / Identity */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-md shadow-slate-900/20">
              <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Royaume du Maroc</span>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">Casablanca et Fès</span>
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
              className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 text-xs font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Simuler l'intégration d'un fichier Excel"
            >
              <Upload className="h-4 w-4 text-slate-900 stroke-[2.5]" />
              <span>Importer Excel</span>
            </button>
            
            <button
              id="btn-excel-export"
              onClick={handleExcelExport}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              title="Télécharger l'état actuel au format Excel/CSV"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-6 flex flex-col gap-6">
        
        {/* Dynamic KPIs Block */}
        <section id="kpis-section">
          <KpiSection kpis={kpis} />
        </section>

        {/* Filters Panel */}
        <section id="filters-section">
          <FilterSection
            filters={filters}
            setFilters={setFilters}
            villes={uniqueVilles}
            categories={uniqueCategories}
            sources={uniqueSources}
            quartiers={uniqueQuartiers}
          />
        </section>

        {/* Informative Note banner */}
        <div className="p-3.5 bg-slate-100/50 rounded-xl border border-slate-200 flex items-center gap-3 text-xs text-slate-800 font-semibold shadow-xs">
          <div className="p-1 bg-slate-200 rounded-lg text-slate-700">
            <Info className="h-4 w-4 stroke-[2.5]" />
          </div>
          <p className="leading-relaxed uppercase text-[10px] tracking-wide text-slate-600">
            <strong className="text-slate-900 font-black">Conseil :</strong> Cliquez sur un établissement dans le panneau latéral pour recentrer la carte instantanément et afficher son itinéraire Google Maps.
          </p>
        </div>

        {/* Spatial Geospatial Core Section (Map + Sidebar) */}
        <section id="geospatial-core" className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* Left panel: Interactive Sidebar List (approx 30% / 4 cols) */}
          <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-[600px]">
            <SidebarList
              establishments={filteredEstablishments}
              selectedId={selectedId}
              onSelectEstablishment={handleSelectEstablishment}
            />
          </div>

          {/* Right panel: Grand Interactive Map (approx 70% / 8 cols) */}
          <div className="lg:col-span-8 h-[500px] lg:h-[600px]">
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
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 pt-8 pb-4 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-[10px] font-black uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-slate-400" />
            <span>Architecture PostGIS préréglée. Mode actuel : Simulation Excel.</span>
          </div>
          <div>
            <span>© 2026 Ministère de la Santé - Royaume du Maroc. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Développé pour la</span>
            <Heart className="h-3.5 w-3.5 text-rose-600 fill-rose-600" />
            <span>Cartographie Sanitaire</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
