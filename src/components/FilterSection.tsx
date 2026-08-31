/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Search, Tag, ShieldCheck, RotateCcw, Globe, MapPin, ChevronDown, Check } from 'lucide-react';
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

  const handleSelectChange = (field: 'source', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const toggleCategorie = (categorie: string) => {
    setFilters(prev => ({
      ...prev,
      categorie: prev.categorie.includes(categorie)
        ? prev.categorie.filter(c => c !== categorie)
        : [...prev.categorie, categorie],
    }));
  };

  // Menu déroulant à cases à cocher pour la catégorie (multi-sélection) — fermeture au clic extérieur
  const [categorieOuvert, setCategorieOuvert] = useState(false);
  const categorieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categorieRef.current && !categorieRef.current.contains(e.target as Node)) {
        setCategorieOuvert(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      categorie: [],
      source: ''
      // Pays/ville ne sont pas des filtres au sens strict (ils changent le périmètre affiché
      // partout sur la page) — on ne les réinitialise pas ici, comme quartier.
    }));
  };

  const isFiltered = filters.search !== '' || filters.categorie.length > 0 || filters.source !== '';

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

          {/* Catégorie filter (multi-sélection) */}
          <div className="relative" ref={categorieRef}>
            <label id="filter-categorie-label" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <Tag className="h-3 w-3 text-purple-500" /> CATÉGORIE
            </label>
            <button
              id="filter-categorie"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={categorieOuvert}
              aria-labelledby="filter-categorie-label"
              onClick={() => setCategorieOuvert(o => !o)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="truncate">
                {filters.categorie.length === 0
                  ? 'Toutes les catégories'
                  : filters.categorie.length === 1
                    ? filters.categorie[0]
                    : `${filters.categorie.length} catégories sélectionnées`}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${categorieOuvert ? 'rotate-180' : ''}`} />
            </button>

            {categorieOuvert && (
              <div
                role="listbox"
                aria-multiselectable="true"
                className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1.5"
              >
                {categories
                  .filter(c => c !== "Cabinet Médical")
                  .map(c => {
                    const selected = filters.categorie.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => toggleCategorie(c)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 ${selected ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{c}</span>
                      </button>
                    );
                  })}
                {filters.categorie.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, categorie: [] }))}
                    className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100 mt-1"
                  >
                    Effacer la sélection
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Source filter */}
          <div className="relative">
            <label htmlFor="filter-source" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> SOURCE
            </label>
            <div className="flex gap-2 items-center">
              <select
                id="filter-source"
                className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer truncate"
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