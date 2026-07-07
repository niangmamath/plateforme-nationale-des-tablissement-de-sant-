/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Etablissement } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { BarChart3, PieChart as PieIcon, Landmark, HelpCircle, Eye, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsDashboardProps {
  establishments: Etablissement[];
}

export default function StatsDashboard({ establishments }: StatsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'ville' | 'categorie' | 'quartier' | 'source'>('ville');

  // Solid, high-contrast palette
  const COLOR_PALETTE = [
    '#0f172a', // Slate 900
    '#2563eb', // Blue 600
    '#4f46e5', // Indigo 600
    '#0891b2', // Cyan 600
    '#16a34a', // Green 600
    '#ea580c', // Orange 600
    '#db2777', // Pink 600
    '#7c3aed'  // Purple 600
  ];

  // --- Aggregate data ---
  const statsByVille = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => {
      counts[e.ville] = (counts[e.ville] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [establishments]);

  const statsByCategorie = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments
      .filter(e => e.categorie !== "Cabinet Médical") // <--- ON EXCLUT LES CABINETS ICI
      .forEach(e => {
        counts[e.categorie] = (counts[e.categorie] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [establishments]);

  const statsByQuartier = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => {
      counts[e.quartier] = (counts[e.quartier] || 0) + 1;
    });
    // Limit to top 8 neighborhoods to avoid overcrowding the chart
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [establishments]);

  const statsBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => {
      counts[e.source] = (counts[e.source] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [establishments]);

  // Total rating average
  const avgRating = useMemo(() => {
    const rated = establishments.filter(e => e.rating);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    return Number((sum / rated.length).toFixed(2));
  }, [establishments]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-slate-900" />
            <span>Statistiques & Analyse Décisionnelle</span>
          </h2>
          <p className="text-[10px] font-semibold uppercase text-slate-400 mt-0.5">Distribution et insights en temps réel du réseau national</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 border border-slate-200 rounded-xl max-w-full overflow-x-auto">
          <button
            id="tab-stat-ville"
            onClick={() => setActiveTab('ville')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ville' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Villes
          </button>
          <button
            id="tab-stat-quartier"
            onClick={() => setActiveTab('quartier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'quartier' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Quartiers
          </button>
          <button
            id="tab-stat-categorie"
            onClick={() => setActiveTab('categorie')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'categorie' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Catégories
          </button>
          <button
            id="tab-stat-source"
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'source' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sources
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle: Core Active Chart */}
        <div className="lg:col-span-2 h-[300px] w-full min-w-0">
          {establishments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <BarChart3 className="h-8 w-8 mb-2 stroke-1" />
              <p className="text-xs font-bold uppercase">Données insuffisantes pour générer des graphiques</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'ville' ? (
                <BarChart data={statsByVille} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    labelStyle={{ fontWeight: 'black', fontSize: '11px', color: '#0f172a', textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="value" name="Établissements" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              ) : activeTab === 'quartier' ? (
                <AreaChart data={statsByQuartier} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorQuartier" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    labelStyle={{ fontWeight: 'black', fontSize: '11px', color: '#0f172a', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="value" name="Établissements" stroke="#4f46e5" fillOpacity={1} fill="url(#colorQuartier)" strokeWidth={3} />
                </AreaChart>
              ) : activeTab === 'categorie' ? (
                <PieChart>
                  <Pie
                    data={statsByCategorie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statsByCategorie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                </PieChart>
              ) : (
                <BarChart data={statsBySource} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} className="font-bold" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  />
                  <Bar dataKey="value" name="Données" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Right Panel: Contextual Insights */}
        <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 lg:pl-6 pt-6 lg:pt-0">
          <div>
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Insights Clés</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg mt-0.5 border border-blue-200">
                  <TrendingUp className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 leading-none">Densité Régionale</h4>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1.5 leading-relaxed">
                    {statsByVille[0] ? (
                      <>La ville de <span className="font-black text-slate-900">{statsByVille[0].name}</span> domine l'offre de soins nationale sur cette sélection avec <span className="font-black text-slate-900">{statsByVille[0].value}</span> établissements cartographiés.</>
                    ) : 'Aucun établissement.'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <div className="p-1.5 bg-purple-100 text-purple-800 rounded-lg mt-0.5 border border-purple-200">
                  <PieIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 leading-none">Mix de Spécialités</h4>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1.5 leading-relaxed">
                    {statsByCategorie[0] ? (
                      <>Les <span className="font-black text-slate-900">{statsByCategorie[0].name}s</span> constituent la catégorie la plus représentée ({statsByCategorie[0].value} unités).</>
                    ) : 'Aucun.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px]">
            <div className="text-slate-400 font-black uppercase tracking-wider">Score moyen national</div>
            <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md font-black border border-amber-200 text-xs">
              <span>★</span>
              <span>{avgRating || "4.5"}</span>
              <span className="text-slate-400 font-bold">/5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
