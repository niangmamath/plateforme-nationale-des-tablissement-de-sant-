import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import { PaysGeo, VilleGeo } from '../types';

interface Props {
  countries: PaysGeo[];
  selectedCountry: PaysGeo;
  selectedCity: VilleGeo;
  onCountryChange: (country: PaysGeo) => void;
  onCityChange: (city: VilleGeo) => void;
}

export default function GlobalLocationSelector({ countries, selectedCountry, selectedCity, onCountryChange, onCityChange }: Props) {
  
  const handleCountrySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = countries.find(c => c.id === e.target.value);
    if (newCountry) {
      onCountryChange(newCountry);
      onCityChange(newCountry.villes[0]); // Bascule sur la première ville par défaut
    }
  };

  const handleCitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = selectedCountry.villes.find(v => v.id === e.target.value);
    if (newCity) onCityChange(newCity);
  };

  return (
    <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-lg z-50 relative">
      <div className="flex items-center gap-2 font-black text-xl tracking-wide">
        <Globe className="h-6 w-6 text-blue-400" />
        <span className="text-white">Med<span className="text-blue-400">Implant</span> B2B</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Sélecteur de Pays */}
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-700">
          <Globe className="h-4 w-4 text-slate-400" />
          <select 
            value={selectedCountry.id} 
            onChange={handleCountrySelect}
            className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
          >
            {countries.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.nom}</option>)}
          </select>
        </div>

        {/* Sélecteur de Ville */}
        <div className="flex items-center gap-2 bg-blue-600/20 rounded-lg px-3 py-1.5 border border-blue-500/30">
          <MapPin className="h-4 w-4 text-blue-400" />
          <select 
            value={selectedCity.id} 
            onChange={handleCitySelect}
            className="bg-transparent text-sm font-bold text-blue-100 outline-none cursor-pointer"
          >
            {selectedCountry.villes.map(v => <option key={v.id} value={v.id} className="bg-slate-800 text-white">{v.nom}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}