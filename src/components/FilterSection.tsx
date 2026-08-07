/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, Tag, ShieldCheck, RotateCcw, Globe, MapPin } from 'lucide-react';
import { FilterState, PaysGeo, VilleGeo } from '../types';

const TOUTES_LES_VILLES = '__all__';

interface FilterSectionProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  categories: string[];
  sources: string[];
  countries: PaysGeo[];
  selectedCountry: PaysGeo;
  selectedCity: VilleGeo | null;
  onCountryChange: (country: PaysGeo) => void;
  onCityChange: (city: VilleGeo | null) => void;
}

export default function FilterSection({
  filters,
  setFilters,
  categories,
  sources,
  countries,
  selectedCountry,
  selectedCity,
  onCountryChange,
  onCityChange
}: FilterSectionProps) {

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleSelectChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleCountrySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = countries.find(c => c.id === e.target.value);
    if (newCountry) {
      onCountryChange(newCountry);
      onCityChange(null); // Retour sur "toutes les villes" du nouveau pays
    }
  };

  const handleCitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === TOUTES_LES_VILLES) {
      onCityChange(null);
      return;
    }
    const newCity = selectedCountry.villes.find(v => v.id === e.target.value);
    if (newCity) onCityChange(newCity);
  };

  const resetFilters = () => {
    setFilters(prev => ({
      ...prev,
      search: '',
      categorie: '',
      source: ''
      // Pays/ville ne sont pas des filtres au sens strict (ils changent le périmètre affiché
      // partout sur la page) — on ne les réinitialise pas ici, comme quartier.
    }));
  };

  const isFiltered = filters.search !== '' || filters.categorie !== '' || filters.source !== '';

  return (
    <div id="filter-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <label htmlFor="search-input" className="sr-only">Rechercher un établissement</label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            id="search-input"
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-800 transition-all text-sm font-semibold"
            placeholder="Rechercher par nom, adresse, spécialité..."
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Pays filter */}
          <div className="relative">
            <label htmlFor="filter-pays" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <Globe className="h-3 w-3 text-blue-500" /> PAYS
            </label>
            <select
              id="filter-pays"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer"
              value={selectedCountry.id}
              onChange={handleCountrySelect}
            >
              {countries.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {/* Ville filter */}
          <div className="relative">
            <label htmlFor="filter-ville" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-blue-500" /> VILLE
            </label>
            <select
              id="filter-ville"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer"
              value={selectedCity ? selectedCity.id : TOUTES_LES_VILLES}
              onChange={handleCitySelect}
            >
              <option value={TOUTES_LES_VILLES}>Toutes les villes</option>
              {selectedCountry.villes.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
            </select>
          </div>

          {/* Catégorie filter */}
          <div className="relative">
            <label htmlFor="filter-categorie" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <Tag className="h-3 w-3 text-purple-500" /> CATÉGORIE
            </label>
            <select
              id="filter-categorie"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer"
              value={filters.categorie}
              onChange={(e) => handleSelectChange('categorie', e.target.value)}
            >
              <option value="">Toutes les catégories</option>
              {categories
                .filter(c => c !== "Cabinet Médical") 
                .map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
            </select>
          </div>
          
          {/* Source filter */}
          <div className="relative">
            <label htmlFor="filter-source" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> SOURCE
            </label>
            <div className="flex gap-2 items-center">
              <select
                id="filter-source"
                className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer"
                value={filters.source}
                onChange={(e) => handleSelectChange('source', e.target.value)}
              >
                <option value="">Toutes les sources</option>
                {sources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {isFiltered && (
                <button
                  id="btn-reset-filters"
                  onClick={resetFilters}
                  className="px-4 py-2.5 border-2 border-rose-500 bg-white hover:bg-rose-50 text-rose-600 transition-all rounded-xl flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer whitespace-nowrap shadow-sm hover:shadow active:scale-95"
                  title="Réinitialiser les filtres (recherche, catégorie, source)"
                >
                  <RotateCcw className="h-3.5 w-3.5 stroke-[3]" />
                  RÀZ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}