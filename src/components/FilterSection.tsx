/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Search, MapPin, Tag, ShieldCheck, RotateCcw } from 'lucide-react';
import { FilterState } from '../types';

interface FilterSectionProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  villes: string[];
  categories: string[];
  sources: string[];
  quartiers: string[];
}

export default function FilterSection({
  filters,
  setFilters,
  villes,
  categories,
  sources,
  quartiers
}: FilterSectionProps) {
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleSelectChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [field]: value };
      // If we change the city, we reset the neighborhood filter to avoid invalid combinations
      if (field === 'ville') {
        next.quartier = '';
      }
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      ville: '',
      quartier: '',
      categorie: '',
      source: ''
    });
  };

  const isFiltered = Object.values(filters).some(v => v !== '');

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
          {/* Ville filter */}
          <div className="relative">
            <label htmlFor="filter-ville" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-blue-500" /> VILLE
            </label>
            <select
              id="filter-ville"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer"
              value={filters.ville}
              onChange={(e) => handleSelectChange('ville', e.target.value)}
            >
              <option value="">Toutes les villes ({villes.length})</option>
              {villes.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Quartier filter */}
          <div className="relative">
            <label htmlFor="filter-quartier" className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-amber-500" /> QUARTIER
            </label>
            <select
              id="filter-quartier"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              value={filters.quartier}
              onChange={(e) => handleSelectChange('quartier', e.target.value)}
              disabled={!filters.ville && quartiers.length === 0}
            >
              <option value="">{filters.ville ? `Tous les quartiers (${quartiers.length})` : "Sélectionnez une ville"}</option>
              {quartiers.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
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
                // On ajoute ce .filter pour masquer la catégorie "Cabinet Médical"
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
                  title="Réinitialiser tous les filtres"
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
