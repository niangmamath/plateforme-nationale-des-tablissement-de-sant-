/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Etablissement } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, Sparkles, LayoutDashboard, Map, Users, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { motion } from 'motion/react';

interface ZoneDemographie {
  nom: string;
  ville: string;
  population: number;
  densite: number;
  pop15_59: number;
  pop60_plus: number;
  prixM2: number;
}

interface StatsDashboardProps {
  establishments: Etablissement[];
  zones: ZoneDemographie[];
}

export default function StatsDashboard({ establishments, zones }: StatsDashboardProps) {
  type TabType = 'demographie' | 'ville' | 'quartier' | 'categorie' | 'source';
  const [activeTab, setActiveTab] = useState<TabType>('demographie');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const COLOR_PALETTE = ['#2563eb', '#0ea5e9', '#4f46e5', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b'];

  // Établissements par zone (toutes catégories confondues — la répartition par spécialité est
  // déjà disponible dans l'onglet "categorie") — plus de décompte codé en dur sur 3 spécialités.
  const demographicAnalysis = useMemo(() => {
    const currentVilles = new Set(establishments.map(e => e.ville));

    return zones.map(arr => {
      const arrNameClean = arr.nom.toLowerCase().replace(/[-'\s]/g, '');
      const etabsInArr = establishments.filter(e => {
        const etabArrClean = (e.arrondissement || '').toLowerCase().replace(/[-'\s]/g, '');
        return etabArrClean === arrNameClean || etabArrClean.includes(arrNameClean) || arrNameClean.includes(etabArrClean);
      });

      const totalEtabs = etabsInArr.length;
      const ratio100k = arr.population > 0 ? ((totalEtabs / arr.population) * 100000).toFixed(1) : "0.0";

      return { ...arr, totalEtabs, ratio100k, etabsInArr };
    })
    .filter(a => currentVilles.has(a.ville))
    .filter(a => a.nom !== "Moulay Rachid" && a.nom !== "Zouagha");
  }, [establishments, zones]);

  const sortedDemographics = useMemo(() => {
    let sortableItems = [...demographicAnalysis];
    if (sortConfig === null) {
      sortableItems.sort((a, b) => b.totalEtabs - a.totalEtabs);
      return sortableItems;
    }
    sortableItems.sort((a, b) => {
      let aValue = a[sortConfig.key as keyof typeof a];
      let bValue = b[sortConfig.key as keyof typeof b];
      if (sortConfig.key === 'ratio100k') {
        aValue = parseFloat(aValue as string);
        bValue = parseFloat(bValue as string);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [demographicAnalysis, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ChevronsUpDown className="h-3 w-3 text-slate-300 ml-1 inline shrink-0" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-blue-600 ml-1 inline shrink-0" /> : <ChevronDown className="h-3 w-3 text-blue-600 ml-1 inline shrink-0" />;
  };

  const statsByVille = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => { counts[e.ville] = (counts[e.ville] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [establishments]);

  const statsByCategorie = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.filter(e => e.categorie !== "Cabinet Médical").forEach(e => {
      counts[e.categorie] = (counts[e.categorie] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [establishments]);

  const statsByQuartier = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => { counts[e.quartier] = (counts[e.quartier] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [establishments]);

  const statsBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    establishments.forEach(e => { counts[e.source] = (counts[e.source] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [establishments]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 md:p-8 mt-6"
    >
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-blue-600" />
            <span>Analytique & Intelligence Géospatiale</span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Plateforme d'Aide à la Décision - V2.0 (Dynamic Engine)</p>
        </div>

        <div className="flex p-1.5 bg-slate-50/80 border border-slate-200/60 rounded-xl w-full xl:w-auto overflow-x-auto scrollbar-none shadow-inner">
          {(['demographie', 'ville', 'quartier', 'categorie', 'source'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              {tab === 'demographie' ? 'Démographie' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full min-h-[320px]">
        {establishments.length === 0 ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <BarChart3 className="h-8 w-8 mb-2 stroke-1" />
            <p className="text-xs font-bold uppercase">Données insuffisantes</p>
          </div>
        ) : (
          <div className="h-full w-full">

            {/* ONGLET DEMOGRAPHIE */}
            {activeTab === 'demographie' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse min-w-[950px] select-none">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase font-black tracking-wider text-slate-500">
                      <th className="p-3 pl-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('nom')}>
                        <Map className="h-3 w-3 inline mr-1" /> Arrondissement {getSortIcon('nom')}
                      </th>
                      <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('population')}>
                        <Users className="h-3 w-3 inline mr-1" /> Pop. {getSortIcon('population')}
                      </th>
                      <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('densite')}>
                        Densité {getSortIcon('densite')}
                      </th>
                      <th className="p-3 text-center border-l border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('pop15_59')}>
                        15-59 ans {getSortIcon('pop15_59')}
                      </th>
                      <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('pop60_plus')}>
                        60+ ans {getSortIcon('pop60_plus')}
                      </th>
                      <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('prixM2')}>
                        Prix Immo {getSortIcon('prixM2')}
                      </th>
                      <th className="p-3 text-center border-l border-slate-200 text-blue-800 bg-blue-100/50 cursor-pointer hover:bg-blue-200/50 transition-colors" onClick={() => handleSort('totalEtabs')}>
                        Établissements {getSortIcon('totalEtabs')}
                      </th>
                      <th className="p-3 text-center bg-indigo-50/50 text-indigo-800 cursor-pointer hover:bg-indigo-100/50 transition-colors" onClick={() => handleSort('ratio100k')}>
                        Couv. {getSortIcon('ratio100k')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700 bg-white">
                    {sortedDemographics.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4 font-bold text-slate-900">{row.nom} <span className="text-[9px] text-slate-400 font-normal ml-1">({row.ville})</span></td>
                        <td className="p-3">{row.population.toLocaleString('fr-FR')}</td>
                        
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${row.densite > 20000 ? 'bg-red-50 text-red-700 border-red-100' : row.densite < 13000 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {row.densite.toLocaleString('fr-FR')}
                          </span>
                        </td>

                        <td className="p-3 text-center border-l border-slate-50">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${row.pop15_59 >= 62 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : row.pop15_59 <= 59.5 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {row.pop15_59.toFixed(1)}%
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${row.pop60_plus >= 20 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : row.pop60_plus <= 15 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {row.pop60_plus.toFixed(1)}%
                          </span>
                        </td>
                        
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${row.prixM2 >= 14000 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : row.prixM2 <= 8000 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {row.prixM2.toLocaleString('fr-FR')} DH
                          </span>
                        </td>

                        <td className="p-3 text-center font-black text-blue-800 bg-blue-50/20 border-l border-slate-50">{row.totalEtabs}</td>
                        
                        <td className="p-3 text-center bg-indigo-50/10">
                          <span className={`px-2.5 py-1 rounded-lg font-black shadow-sm border text-[11px] ${Number(row.ratio100k) < 2 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            {row.ratio100k}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* GRAPHIQUES */}
            {activeTab === 'ville' && (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={statsByVille} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold uppercase" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} />
                  <Bar dataKey="value" name="Établissements" radius={[6, 6, 0, 0]} barSize={45}>
                    {statsByVille.map((_, index) => ( <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} /> ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'quartier' && (
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={statsByQuartier} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorQuartier" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} className="font-bold" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" name="Établissements" stroke="#4f46e5" fillOpacity={1} fill="url(#colorQuartier)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'categorie' && (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie data={statsByCategorie} cx="50%" cy="50%" innerRadius={90} outerRadius={130} paddingAngle={4} dataKey="value" stroke="none">
                    {statsByCategorie.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'source' && (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={statsBySource} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} className="font-bold" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={100} className="font-bold" />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" name="Données" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span>Synthèse & Insights Stratégiques</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100/50 shadow-sm flex items-start gap-4">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0 mt-1">
              <TrendingUp className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-black uppercase text-blue-900 tracking-wide">Densité Régionale</h4>
              <p className="text-xs font-medium text-slate-600 leading-relaxed mt-1">
                {statsByVille[0] ? (
                  <>La ville de <span className="font-black text-blue-800">{statsByVille[0].name}</span> domine l'offre avec <span className="font-black text-blue-800">{statsByVille[0].value}</span> entités cartographiées.</>
                ) : 'Aucun établissement.'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200/60 shadow-sm flex items-start gap-4">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-1">
              <PieIcon className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">Mix de Spécialités</h4>
              <p className="text-xs font-medium text-slate-600 leading-relaxed mt-1">
                {statsByCategorie[0] ? (
                  <>Les <span className="font-black text-indigo-700">{statsByCategorie[0].name}s</span> constituent la catégorie majeure ({statsByCategorie[0].value} unités actives).</>
                ) : 'Aucun.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}