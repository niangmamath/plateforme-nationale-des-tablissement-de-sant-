// Les 8 onglets du dashboard admin. Chaque onglet : fetch /api/admin-ui/stats avec sa section,
// puis Recharts à partir du JSON reçu. Palette inspirée de StatsDashboard.tsx (bleu-indigo).

import { useEffect, useState, useCallback, FormEvent, ReactNode } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users as UsersIcon, FileText, Building2, FileEdit, AlertTriangle, MapPinned,
  CheckCircle2, Mail as MailIcon, Lock as LockIcon, UserPlus, Trash2, Loader2, AlertCircle,
  TrendingUp, Clock, Stethoscope, TrendingDown, Package, Wrench, Activity, Scale,
} from 'lucide-react';

const COLOR_PALETTE = ['#2563eb', '#0d9488', '#a9690a', '#d03b3b', '#7c3aed', '#0CA30C', '#8891A0', '#1e3a8a'];
const C = COLOR_PALETTE;

function useFetch<T>(section: string): { data: T | null; chargement: boolean; erreur: string | null; recharger: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    setChargement(true); setErreur(null);
    fetch(`/api/admin-ui/stats?section=${section}`, { credentials: 'same-origin' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur serveur');
        return r.json();
      })
      .then((d: T) => setData(d))
      .catch(e => setErreur(e.message || 'Erreur'))
      .finally(() => setChargement(false));
  }, [section]);

  useEffect(() => { charger(); }, [charger]);

  return { data, chargement, erreur, recharger: charger };
}

// --- Primitives UI ---
function Carte({ titre, sousTitre, children, className = '' }: { titre: string; sousTitre?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-5 lg:p-6 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">{titre}</h3>
        {sousTitre && <p className="text-xs text-slate-500 mt-0.5">{sousTitre}</p>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, valeur, Icone, teinte = 'blue' }: { label: string; valeur: number | string; Icone: typeof UsersIcon; teinte?: 'blue' | 'teal' | 'amber' | 'rose' | 'violet' | 'emerald' }) {
  const teintes = {
    blue:    { bg: 'from-blue-50 to-blue-100/50',       icon: 'bg-blue-100 text-blue-700',       accent: 'text-blue-900' },
    teal:    { bg: 'from-teal-50 to-teal-100/50',       icon: 'bg-teal-100 text-teal-700',       accent: 'text-teal-900' },
    amber:   { bg: 'from-amber-50 to-amber-100/50',     icon: 'bg-amber-100 text-amber-700',     accent: 'text-amber-900' },
    rose:    { bg: 'from-rose-50 to-rose-100/50',       icon: 'bg-rose-100 text-rose-700',       accent: 'text-rose-900' },
    violet:  { bg: 'from-violet-50 to-violet-100/50',   icon: 'bg-violet-100 text-violet-700',   accent: 'text-violet-900' },
    emerald: { bg: 'from-emerald-50 to-emerald-100/50', icon: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-900' },
  }[teinte];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${teintes.bg} border border-slate-200/60 rounded-2xl p-5 lg:p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</div>
          <div className={`mt-2 text-3xl lg:text-4xl font-bold ${teintes.accent} tabular-nums`}>
            {typeof valeur === 'number' ? valeur.toLocaleString('fr-FR') : valeur}
          </div>
        </div>
        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${teintes.icon} flex items-center justify-center shrink-0`}>
          <Icone className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
      </div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">Chargement…</span>
    </div>
  );
}

function Erreur({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-semibold text-rose-900">Impossible de charger les données</div>
        <div className="text-xs text-rose-700 mt-0.5">{msg}</div>
      </div>
    </div>
  );
}

function Grille({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const cls = cols === 4
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5'
    : cols === 3
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5'
    : 'grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5';
  return <div className={cls}>{children}</div>;
}

const chartMargin = { top: 5, right: 10, left: 0, bottom: 5 };
const axisStyle = { fontSize: 11, fill: '#64748b' };

// === VUE D'ENSEMBLE ===
interface Overview {
  utilisateurs: number; business_plans_total: number;
  etablissements_publies: number; etablissements_brouillons: number;
  specialites_publiees: number; specialites_brouillons: number;
  users_7j: number; users_7j_precedent: number;
  business_plans_7j: number; business_plans_7j_precedent: number;
  signalements_7j: number; signalements_7j_precedent: number;
  signalements_ouverts: number; signalements_traites: number;
  taux_verifies: number;
  pays: number; villes: number; zones: number; zones_donnees_completes: number;
  serie_inscriptions_30j: { jour: string; n: number }[];
  serie_business_plans_30j: { jour: string; n: number }[];
  serie_signalements_30j: { jour: string; n: number }[];
  dernier_user: string | null; dernier_etablissement: string | null;
}

// Mini-tendance : % change vs la période précédente, affiché à côté du KPI.
function Tendance({ courant, precedent }: { courant: number; precedent: number }) {
  if (precedent === 0 && courant === 0) return null;
  if (precedent === 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><TrendingUp className="w-3 h-3" />Nouveau</span>;
  const pct = Math.round(((courant - precedent) / precedent) * 100);
  if (pct === 0) return <span className="text-xs font-medium text-slate-500">Stable</span>;
  const pos = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${pos ? 'text-emerald-700' : 'text-rose-700'}`}>
      <TrendingUp className={`w-3 h-3 ${pos ? '' : 'rotate-180'}`} />
      {pos ? '+' : ''}{pct} %
    </span>
  );
}

function KpiAvecTendance({ label, valeur, Icone, teinte, courant, precedent, suffixe }: {
  label: string; valeur: number | string; Icone: typeof UsersIcon;
  teinte: 'blue' | 'teal' | 'amber' | 'rose' | 'violet' | 'emerald';
  courant: number; precedent: number; suffixe?: string;
}) {
  const teintes = {
    blue:    { bg: 'from-blue-50 to-blue-100/50',       icon: 'bg-blue-100 text-blue-700',       accent: 'text-blue-900' },
    teal:    { bg: 'from-teal-50 to-teal-100/50',       icon: 'bg-teal-100 text-teal-700',       accent: 'text-teal-900' },
    amber:   { bg: 'from-amber-50 to-amber-100/50',     icon: 'bg-amber-100 text-amber-700',     accent: 'text-amber-900' },
    rose:    { bg: 'from-rose-50 to-rose-100/50',       icon: 'bg-rose-100 text-rose-700',       accent: 'text-rose-900' },
    violet:  { bg: 'from-violet-50 to-violet-100/50',   icon: 'bg-violet-100 text-violet-700',   accent: 'text-violet-900' },
    emerald: { bg: 'from-emerald-50 to-emerald-100/50', icon: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-900' },
  }[teinte];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${teintes.bg} border border-slate-200/60 rounded-2xl p-5 lg:p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</div>
          <div className={`mt-2 text-3xl lg:text-4xl font-bold ${teintes.accent} tabular-nums`}>
            {typeof valeur === 'number' ? valeur.toLocaleString('fr-FR') : valeur}{suffixe}
          </div>
          <div className="mt-2"><Tendance courant={courant} precedent={precedent} /><span className="text-xs text-slate-500 ml-1">vs 7j précédents</span></div>
        </div>
        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${teintes.icon} flex items-center justify-center shrink-0`}>
          <Icone className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, teinte }: { data: { jour: string; n: number }[]; teinte: string }) {
  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${teinte}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={teinte} stopOpacity={0.5}/>
            <stop offset="95%" stopColor={teinte} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Tooltip
          cursor={{ stroke: teinte, strokeWidth: 1, strokeDasharray: '3 3' }}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        />
        <Area type="monotone" dataKey="n" stroke={teinte} strokeWidth={2} fill={`url(#spark-${teinte})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TabVueEnsemble() {
  const { data, chargement, erreur } = useFetch<Overview>('overview');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      {/* Rangée 1 : 4 totaux principaux */}
      <Grille cols={4}>
        <Kpi label="Utilisateurs"                 valeur={data.utilisateurs}           Icone={UsersIcon}  teinte="blue" />
        <Kpi label="Business plans générés"       valeur={data.business_plans_total}   Icone={FileText}   teinte="violet" />
        <Kpi label="Établissements publiés"       valeur={data.etablissements_publies} Icone={Building2}  teinte="emerald" />
        <Kpi label="Spécialités publiées"         valeur={data.specialites_publiees}   Icone={Stethoscope} teinte="teal" />
      </Grille>

      {/* Rangée 2 : 3 KPI avec tendance 7j */}
      <Grille cols={3}>
        <KpiAvecTendance label="Nouveaux utilisateurs (7j)" valeur={data.users_7j}          Icone={UserPlus}       teinte="blue"    courant={data.users_7j}          precedent={data.users_7j_precedent} />
        <KpiAvecTendance label="Business plans (7j)"        valeur={data.business_plans_7j} Icone={FileText}       teinte="violet"  courant={data.business_plans_7j} precedent={data.business_plans_7j_precedent} />
        <KpiAvecTendance label="Signalements reçus (7j)"    valeur={data.signalements_7j}   Icone={AlertTriangle}  teinte="rose"    courant={data.signalements_7j}   precedent={data.signalements_7j_precedent} />
      </Grille>

      {/* Rangée 3 : 3 mini-charts 30 derniers jours */}
      <Grille cols={3}>
        <Carte titre="Inscriptions" sousTitre="30 derniers jours">
          <Sparkline data={data.serie_inscriptions_30j} teinte="#2563eb" />
        </Carte>
        <Carte titre="Business plans générés" sousTitre="30 derniers jours">
          <Sparkline data={data.serie_business_plans_30j} teinte="#7c3aed" />
        </Carte>
        <Carte titre="Signalements reçus" sousTitre="30 derniers jours">
          <Sparkline data={data.serie_signalements_30j} teinte="#d03b3b" />
        </Carte>
      </Grille>

      {/* Rangée 4 : signalements + qualité + brouillons */}
      <Grille cols={4}>
        <Kpi label="Signalements ouverts"      valeur={data.signalements_ouverts}      Icone={AlertTriangle} teinte="rose" />
        <Kpi label="Signalements traités"      valeur={data.signalements_traites}      Icone={CheckCircle2}  teinte="emerald" />
        <Kpi label="Établissements brouillons" valeur={data.etablissements_brouillons} Icone={FileEdit}      teinte="amber" />
        <Kpi label="E-mails vérifiés"          valeur={`${data.taux_verifies} %`}      Icone={MailIcon}      teinte="teal" />
      </Grille>

      {/* Rangée 5 : couverture géographique */}
      <Carte titre="Couverture géographique" sousTitre="Pays, villes et zones couverts par le pipeline">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pays</div>
            <div className="text-3xl font-bold text-blue-700 mt-2 tabular-nums">{data.pays}</div>
          </div>
          <div className="text-center p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Villes</div>
            <div className="text-3xl font-bold text-blue-700 mt-2 tabular-nums">{data.villes}</div>
          </div>
          <div className="text-center p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zones</div>
            <div className="text-3xl font-bold text-blue-700 mt-2 tabular-nums">{data.zones}</div>
          </div>
          <div className="text-center p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zones complètes</div>
            <div className="text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
              {data.zones_donnees_completes}
              <span className="text-sm text-slate-400 font-normal ml-1">/ {data.zones}</span>
            </div>
          </div>
        </div>
      </Carte>

      {/* Rangée 6 : dernières activités */}
      <Grille cols={2}>
        <Carte titre="Dernière inscription" sousTitre="Date du compte utilisateur le plus récent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{fmtDate(data.dernier_user)}</div>
              <div className="text-xs text-slate-500">Dernier compte médecin créé</div>
            </div>
          </div>
        </Carte>
        <Carte titre="Dernier établissement ajouté" sousTitre="Date d'ingestion la plus récente dans la base">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{fmtDate(data.dernier_etablissement)}</div>
              <div className="text-xs text-slate-500">Pipeline toujours actif</div>
            </div>
          </div>
        </Carte>
      </Grille>
    </div>
  );
}

// === ÉTABLISSEMENTS ===
interface StatEt {
  par_statut: { statut: string; n: number }[];
  par_categorie: { categorie: string; n: number }[];
  par_ville: { ville: string; n: number }[];
  par_source: { source: string; n: number }[];
  verification_requise: number;
  doublons_possibles: number;
  par_mois: { mois: string; n: number }[];
}

export function TabEtablissements() {
  const { data, chargement, erreur } = useFetch<StatEt>('etablissements');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <Grille cols={2}>
        <Carte titre="Statut" sousTitre="Publiés vs brouillons">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.par_statut} dataKey="n" nameKey="statut" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.par_statut.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Qualité des données">
          <div className="grid grid-cols-2 gap-3 h-[240px] content-center">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 uppercase tracking-wide">
                <AlertCircle className="w-3.5 h-3.5" /> À vérifier
              </div>
              <div className="text-3xl font-bold text-amber-900 mt-2 tabular-nums">{data.verification_requise.toLocaleString('fr-FR')}</div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/60 border border-rose-200/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 uppercase tracking-wide">
                <AlertCircle className="w-3.5 h-3.5" /> Doublons
              </div>
              <div className="text-3xl font-bold text-rose-900 mt-2 tabular-nums">{data.doublons_possibles.toLocaleString('fr-FR')}</div>
            </div>
          </div>
        </Carte>
      </Grille>

      <Carte titre="Par catégorie" sousTitre="Top 20">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.par_categorie} layout="vertical" margin={{ ...chartMargin, left: 110 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="categorie" width={110} tick={{ ...axisStyle, fontSize: 10 }} />
            <Tooltip /><Bar dataKey="n" fill={C[0]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      <Grille cols={2}>
        <Carte titre="Par ville" sousTitre="Top 15">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.par_ville} layout="vertical" margin={{ ...chartMargin, left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="ville" width={90} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip /><Bar dataKey="n" fill={C[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Par source" sousTitre="Pipeline de données">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={data.par_source} dataKey="n" nameKey="source" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.par_source.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>

      <Carte titre="Rythme d'ajout" sousTitre="Nouveaux établissements par mois">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.par_mois} margin={chartMargin}>
            <defs>
              <linearGradient id="gradEt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C[0]} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={C[0]} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mois" tick={axisStyle} /><YAxis tick={axisStyle} />
            <Tooltip /><Area type="monotone" dataKey="n" stroke={C[0]} strokeWidth={2} fill="url(#gradEt)" />
          </AreaChart>
        </ResponsiveContainer>
      </Carte>
    </div>
  );
}

// === ZONES ===
interface StatZ {
  pyramide_ages: { zone: string; ville: string; pop0_14: number | null; pop15_59: number | null; pop60_plus: number | null }[];
  prix_loyer: { zone: string; ville: string; prix_m2: number; loyer_m2: number }[];
  manquants: { colonne: string; n: number }[];
}

export function TabZones() {
  const { data, chargement, erreur } = useFetch<StatZ>('zones');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <Grille cols={2}>
        <Carte titre="Pyramide des âges" sousTitre="Par zone — top 40">
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={data.pyramide_ages} layout="vertical" margin={{ ...chartMargin, left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="zone" width={90} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip /><Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pop0_14"   stackId="a" fill={C[0]} name="0-14 ans" />
              <Bar dataKey="pop15_59"  stackId="a" fill={C[1]} name="15-59 ans" />
              <Bar dataKey="pop60_plus" stackId="a" fill={C[2]} name="60+ ans" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Prix du m²" sousTitre="Par zone — top 30">
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={data.prix_loyer} layout="vertical" margin={{ ...chartMargin, left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="zone" width={90} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="prix_m2" fill={C[0]} name="Prix m²" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>
      <Carte titre="Qualité des données" sousTitre="Valeurs manquantes par colonne">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.manquants} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="colonne" tick={axisStyle} /><YAxis tick={axisStyle} />
            <Tooltip /><Bar dataKey="n" fill={C[3]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Carte>
    </div>
  );
}

// === SPÉCIALITÉS ===
interface StatSp {
  par_statut: { statut: string; n: number }[];
  investissement_moyen: number;
  investissement_median: number;
  plus_couteuse: { nom: string; montant: number } | null;
  moins_couteuse: { nom: string; montant: number } | null;
  poids_moyens: { prix: number; population: number; densite: number; pop0_14: number; pop15_59: number; pop60_plus: number; concurrence: number };
  par_cible: { cible: string; n: number }[];
  par_clientele: { type: string; n: number }[];
  nb_etablissements_par_specialite: { id: string; nom: string; nb_etab: number }[];
  specialite_par_ville: { specialite: string; ville: string; n: number }[];
  specialites: { id: string; nom: string; statut: string; poids: { prix: number; population: number; densite: number; pop0_14: number; pop15_59: number; pop60_plus: number; concurrence: number }; frais_preliminaires: number; bfr: number; amenagement: number; machines: number; investissement_total: number; nb_amenagements: number; nb_machines: number; nb_actes: number }[];
}

export function TabSpecialites() {
  const { data, chargement, erreur } = useFetch<StatSp>('specialites');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;

  const publies = data.par_statut.find(s => s.statut === 'publie')?.n ?? 0;
  const brouillons = data.par_statut.find(s => s.statut === 'brouillon')?.n ?? 0;
  const topInvest = [...data.specialites].sort((a, b) => b.investissement_total - a.investissement_total).slice(0, 15);
  const topEtab = data.nb_etablissements_par_specialite.filter(s => s.nb_etab > 0).slice(0, 15);

  // Poids moyens en format Recharts
  const poidsData = Object.entries(data.poids_moyens).map(([critere, val]) => ({ critere, val }));

  // Pivot specialite_par_ville en format stacked bar
  const villesUniques = [...new Set(data.specialite_par_ville.map(d => d.ville))];
  const specialitesUniques = [...new Set(data.specialite_par_ville.map(d => d.specialite))];
  const pivotParSpecialite = specialitesUniques.map(sp => {
    const row: Record<string, string | number> = { specialite: sp };
    for (const v of villesUniques) {
      const match = data.specialite_par_ville.find(d => d.specialite === sp && d.ville === v);
      row[v] = match?.n ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-5">
      {/* Rangée 1 : KPI vue d'ensemble des spécialités */}
      <Grille cols={4}>
        <Kpi label="Publiées"              valeur={publies}                       Icone={CheckCircle2} teinte="emerald" />
        <Kpi label="En brouillon"          valeur={brouillons}                    Icone={FileEdit}     teinte="amber" />
        <Kpi label="Investissement moyen"  valeur={`${(data.investissement_moyen / 1000).toFixed(0)}k DH`} Icone={Scale} teinte="blue" />
        <Kpi label="Investissement médian" valeur={`${(data.investissement_median / 1000).toFixed(0)}k DH`} Icone={Scale} teinte="teal" />
      </Grille>

      {/* Rangée 2 : plus et moins coûteuse */}
      {data.plus_couteuse && data.moins_couteuse && (
        <Grille cols={2}>
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/60 rounded-2xl p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Spécialité la plus coûteuse à ouvrir</div>
                <div className="mt-1 text-xl font-bold text-rose-900 truncate">{data.plus_couteuse.nom}</div>
                <div className="mt-1 text-2xl font-bold text-rose-800 tabular-nums">{data.plus_couteuse.montant.toLocaleString('fr-FR')} DH</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/60 rounded-2xl p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Spécialité la moins coûteuse</div>
                <div className="mt-1 text-xl font-bold text-emerald-900 truncate">{data.moins_couteuse.nom}</div>
                <div className="mt-1 text-2xl font-bold text-emerald-800 tabular-nums">{data.moins_couteuse.montant.toLocaleString('fr-FR')} DH</div>
              </div>
            </div>
          </div>
        </Grille>
      )}

      {/* Rangée 3 : Nombre d'établissements par spécialité (top 15) */}
      <Carte titre="Établissements publiés par spécialité" sousTitre="Combien d'établissements correspondent à chaque spécialité dans la base — top 15">
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={topEtab} layout="vertical" margin={{ ...chartMargin, left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="nom" width={120} tick={{ ...axisStyle, fontSize: 11 }} />
            <Tooltip /><Bar dataKey="nb_etab" fill={C[1]} radius={[0, 6, 6, 0]} name="Établissements" />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      {/* Rangée 4 : Répartition par ville (top 10 spécialités × top 5 villes) */}
      {pivotParSpecialite.length > 0 && (
        <Carte titre="Répartition géographique" sousTitre="Nombre d'établissements par spécialité et par ville — top 10 spécialités, top 5 villes">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={pivotParSpecialite} layout="vertical" margin={{ ...chartMargin, left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="specialite" width={120} tick={{ ...axisStyle, fontSize: 11 }} />
              <Tooltip /><Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              {villesUniques.map((v, i) => (
                <Bar key={v} dataKey={v} stackId="v" fill={C[i % C.length]} name={v} radius={i === villesUniques.length - 1 ? [0, 6, 6, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Carte>
      )}

      {/* Rangée 5 : poids moyens des critères de scoring */}
      <Carte titre="Pondération moyenne des critères de scoring" sousTitre="Sur quels axes la plateforme pondère-t-elle en moyenne pour chaque spécialité ?">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={poidsData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="critere" tick={{ ...axisStyle, fontSize: 11 }} /><YAxis tick={axisStyle} />
            <Tooltip /><Bar dataKey="val" fill={C[0]} radius={[6, 6, 0, 0]} name="Poids moyen" />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      {/* Rangée 6 : Investissement détaillé */}
      <Carte titre="Décomposition de l'investissement" sousTitre="Top 15 — somme aménagement + machines + frais préliminaires + BFR">
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={topInvest} layout="vertical" margin={{ ...chartMargin, left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="nom" width={120} tick={{ ...axisStyle, fontSize: 11 }} />
            <Tooltip /><Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="amenagement"         stackId="a" fill={C[0]} name="Aménagement" />
            <Bar dataKey="machines"            stackId="a" fill={C[1]} name="Machines" />
            <Bar dataKey="frais_preliminaires" stackId="a" fill={C[2]} name="Frais préliminaires" />
            <Bar dataKey="bfr"                 stackId="a" fill={C[3]} name="BFR" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Carte>

      {/* Rangée 7 : Catalogue — nombre d'aménagements, machines, actes */}
      <Carte titre="Richesse du catalogue par spécialité" sousTitre="Nombre d'aménagements, machines et actes définis dans la base">
        <div className="overflow-x-auto -mx-5 lg:-mx-6">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50/60 border-y border-slate-200">
              <tr>
                <th className="text-left px-5 lg:px-6 py-3 font-semibold">Spécialité</th>
                <th className="text-left px-3 py-3 font-semibold">Statut</th>
                <th className="text-right px-3 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" />Aménagements</span></th>
                <th className="text-right px-3 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />Machines</span></th>
                <th className="text-right px-3 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" />Actes</span></th>
                <th className="text-right px-5 lg:px-6 py-3 font-semibold">Investissement</th>
              </tr>
            </thead>
            <tbody>
              {data.specialites.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                  <td className="px-5 lg:px-6 py-3 font-medium text-slate-900">{s.nom}</td>
                  <td className="px-3 py-3">
                    {s.statut === 'publie'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" />Publié</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full"><FileEdit className="w-3 h-3" />Brouillon</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{s.nb_amenagements}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{s.nb_machines}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{s.nb_actes}</td>
                  <td className="px-5 lg:px-6 py-3 text-right font-mono text-slate-900 font-semibold tabular-nums">{s.investissement_total.toLocaleString('fr-FR')} DH</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
    </div>
  );
}

// === UTILISATEURS ===
interface StatUser {
  total: number;
  par_semaine: { semaine: string; n: number }[];
  par_type: { type: string; n: number }[];
  verifies: number;
  verrouilles: number;
  derniers?: { id: number; email: string; date_creation: string; email_verified: boolean; auth: string }[];
}

export function TabUtilisateurs({ role }: { role: 'admin' | 'lecteur' }) {
  const { data, chargement, erreur } = useFetch<StatUser>('utilisateurs');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;
  const pct = data.total ? Math.round((data.verifies / data.total) * 100) : 0;
  return (
    <div className="space-y-5">
      <Grille cols={4}>
        <Kpi label="Comptes au total"       valeur={data.total}       Icone={UsersIcon}    teinte="blue" />
        <Kpi label="E-mails vérifiés"       valeur={data.verifies}    Icone={CheckCircle2} teinte="emerald" />
        <Kpi label="% vérifiés"             valeur={`${pct} %`}       Icone={TrendingUp}   teinte="teal" />
        <Kpi label="Comptes verrouillés"    valeur={data.verrouilles} Icone={LockIcon}     teinte="rose" />
      </Grille>
      <Grille cols={2}>
        <Carte titre="Inscriptions" sousTitre="Nouvelles inscriptions par semaine">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.par_semaine} margin={chartMargin}>
              <defs>
                <linearGradient id="gradU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C[0]} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={C[0]} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semaine" tick={{ ...axisStyle, fontSize: 10 }} /><YAxis tick={axisStyle} />
              <Tooltip /><Area type="monotone" dataKey="n" stroke={C[0]} strokeWidth={2} fill="url(#gradU)" />
            </AreaChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Méthode d'inscription" sousTitre="Email classique vs Google OAuth">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.par_type} dataKey="n" nameKey="type" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.par_type.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>
      {role === 'admin' && data.derniers && (
        <Carte titre="Derniers inscrits" sousTitre="20 inscriptions les plus récentes">
          <div className="overflow-x-auto -mx-5 lg:-mx-6">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50/60 border-y border-slate-200">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">E-mail</th>
                  <th className="text-left px-3 py-3 font-semibold">Date</th>
                  <th className="text-left px-3 py-3 font-semibold">Auth</th>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Vérifié</th>
                </tr>
              </thead>
              <tbody>
                {data.derniers.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-5 lg:px-6 py-3 font-medium text-slate-900">{u.email}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(u.date_creation).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-3"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{u.auth}</span></td>
                    <td className="px-5 lg:px-6 py-3">
                      {u.email_verified
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
      {role === 'lecteur' && (
        <Carte titre="Détails individuels" sousTitre="Réservé aux administrateurs">
          <p className="text-sm text-slate-500 italic">Les détails nominatifs (emails) sont réservés aux administrateurs.</p>
        </Carte>
      )}
    </div>
  );
}

// === BUSINESS PLANS ===
interface StatBP {
  total: number;
  par_user_histogramme: { nb_bp: number; n: number }[];
  top_zones: { zone: string; ville: string; n: number }[];
  top_specialites: { specialite: string; n: number }[];
  abandons_30j: number;
}

export function TabBusinessPlans() {
  const { data, chargement, erreur } = useFetch<StatBP>('business-plans');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;
  const topZonesLabelled = data.top_zones.map(z => ({ ...z, label: `${z.zone} (${z.ville})` }));
  return (
    <div className="space-y-5">
      <Grille cols={2}>
        <Kpi label="Business plans générés" valeur={data.total}        Icone={FileText}    teinte="violet" />
        <Kpi label="Abandons (30+ jours)"   valeur={data.abandons_30j} Icone={Clock}       teinte="amber" />
      </Grille>
      <Carte titre="Nombre de BP par utilisateur" sousTitre="Histogramme — combien d'utilisateurs ont généré N BP ?">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.par_user_histogramme} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nb_bp" tick={axisStyle} label={{ value: 'BP par user', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#64748b' }} /><YAxis tick={axisStyle} />
            <Tooltip /><Bar dataKey="n" fill={C[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Carte>
      <Grille cols={2}>
        <Carte titre="Top zones demandées" sousTitre="Les 15 zones les plus choisies pour un BP">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={topZonesLabelled} layout="vertical" margin={{ ...chartMargin, left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="label" width={110} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip /><Bar dataKey="n" fill={C[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Top spécialités" sousTitre="Les 15 spécialités les plus simulées">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data.top_specialites} layout="vertical" margin={{ ...chartMargin, left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="specialite" width={110} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip /><Bar dataKey="n" fill={C[2]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>
    </div>
  );
}

// === SIGNALEMENTS ===
interface StatSig {
  par_statut: { statut: string; n: number }[];
  par_type: { type: string; n: number }[];
  par_probleme: { type_probleme: string; n: number }[];
  par_mois: { mois: string; n: number }[];
  delai_traitement_h: number | null;
  par_profession: { profession: string; n: number }[];
  ouverts_recents?: { id: number; type: string; nom_prenom: string; email: string; profession: string; statut: string; date_creation: string }[];
}

export function TabSignalements({ role }: { role: 'admin' | 'lecteur' }) {
  const { data, chargement, erreur } = useFetch<StatSig>('signalements');
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur msg={erreur} />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <Grille cols={2}>
        <Carte titre="Par statut" sousTitre="Workflow nouveau → traité">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.par_statut} dataKey="n" nameKey="statut" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.par_statut.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Délai de traitement moyen" sousTitre="Entre nouveau et traité/rejeté">
          <div className="flex items-center justify-center h-[260px]">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 mb-3">
                <Clock className="w-7 h-7 text-blue-700" />
              </div>
              <div className="text-5xl font-bold text-blue-700 tabular-nums">
                {data.delai_traitement_h !== null ? Math.round(data.delai_traitement_h) : '—'}
              </div>
              <div className="text-sm text-slate-500 mt-2">heures en moyenne</div>
            </div>
          </div>
        </Carte>
      </Grille>
      <Grille cols={2}>
        <Carte titre="Par type" sousTitre="Correction vs absence">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.par_type} dataKey="n" nameKey="type" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.par_type.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Par type de problème" sousTitre="Nature des signalements">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.par_probleme} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="type_probleme" tick={{ ...axisStyle, fontSize: 10 }} /><YAxis tick={axisStyle} />
              <Tooltip /><Bar dataKey="n" fill={C[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>
      <Grille cols={2}>
        <Carte titre="Volume mensuel" sousTitre="Signalements reçus par mois">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.par_mois} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mois" tick={axisStyle} /><YAxis tick={axisStyle} />
              <Tooltip /><Line type="monotone" dataKey="n" stroke={C[0]} strokeWidth={2} dot={{ fill: C[0] }} />
            </LineChart>
          </ResponsiveContainer>
        </Carte>
        <Carte titre="Signaleurs par profession" sousTitre="Top 10">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.par_profession} layout="vertical" margin={{ ...chartMargin, left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="profession" width={110} tick={{ ...axisStyle, fontSize: 10 }} />
              <Tooltip /><Bar dataKey="n" fill={C[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>
      </Grille>
      {role === 'admin' && data.ouverts_recents && (
        <Carte titre="Signalements ouverts" sousTitre="20 derniers signalements à traiter">
          <div className="overflow-x-auto -mx-5 lg:-mx-6">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50/60 border-y border-slate-200">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Nom</th>
                  <th className="text-left px-3 py-3 font-semibold">E-mail</th>
                  <th className="text-left px-3 py-3 font-semibold">Profession</th>
                  <th className="text-left px-3 py-3 font-semibold">Type</th>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.ouverts_recents.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-5 lg:px-6 py-3 font-medium text-slate-900">{s.nom_prenom}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{s.email}</td>
                    <td className="px-3 py-3 text-slate-700">{s.profession}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{s.type}</td>
                    <td className="px-5 lg:px-6 py-3">
                      {s.statut === 'nouveau'
                        ? <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">Nouveau</span>
                        : <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">En cours</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
      {role === 'lecteur' && (
        <Carte titre="Détails individuels" sousTitre="Réservé aux administrateurs">
          <p className="text-sm text-slate-500 italic">Les détails nominatifs (emails, noms des signaleurs) sont réservés aux administrateurs.</p>
        </Carte>
      )}
    </div>
  );
}

// === ACCÈS (admin uniquement) ===
interface AdminListItem {
  id: number;
  email: string;
  role: 'admin' | 'lecteur';
  is_founder: boolean;
  date_creation: string;
  active: boolean;
  invite_par_email: string | null;
}

function initialesEmail(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function TabAcces({ moiId }: { moiId: number }) {
  const [liste, setListe] = useState<AdminListItem[] | null>(null);
  const [listeChargement, setListeChargement] = useState(true);
  const [listeErreur, setListeErreur] = useState<string | null>(null);
  const chargerListe = useCallback(() => {
    setListeChargement(true);
    fetch('/api/admin-ui/acces', { credentials: 'same-origin' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur serveur');
        return r.json();
      })
      .then(setListe)
      .catch(e => setListeErreur(e.message))
      .finally(() => setListeChargement(false));
  }, []);
  useEffect(() => { chargerListe(); }, [chargerListe]);

  const [emailInvite, setEmailInvite] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  async function inviter(e: FormEvent) {
    e.preventDefault();
    setMessage(null); setMessageErreur(null); setEnCours(true);
    try {
      const r = await fetch('/api/admin-ui/inviter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ email: emailInvite }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMessageErreur(d.error || "Invitation impossible.");
      else {
        setMessage(d.urlDebug ? `Invitation envoyée. (DEV) Lien : ${d.urlDebug}` : 'Invitation envoyée par e-mail.');
        setEmailInvite(''); chargerListe();
      }
    } catch { setMessageErreur('Erreur réseau.'); }
    finally { setEnCours(false); }
  }

  async function revoquer(id: number, email: string) {
    if (!confirm(`Révoquer l'accès de ${email} ? Cette action est irréversible.`)) return;
    const r = await fetch('/api/admin-ui/revoquer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ id }),
    });
    if (r.ok) chargerListe();
    else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'Révocation impossible.');
    }
  }

  return (
    <div className="space-y-5">
      <Carte titre="Inviter un lecteur" sousTitre="Accès en consultation seule, lien d'activation valable 7 jours">
        <form onSubmit={inviter} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">E-mail du nouveau lecteur</label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email" value={emailInvite} onChange={e => setEmailInvite(e.target.value)} required
                placeholder="nouveau.lecteur@exemple.com"
                className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <button type="submit" disabled={enCours}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md shadow-blue-600/20 transition-all">
            {enCours ? 'Envoi…' : (<><UserPlus className="w-4 h-4" />Inviter</>)}
          </button>
        </form>
        {message && (
          <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 break-all">{message}</p>
          </div>
        )}
        {messageErreur && (
          <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-800">{messageErreur}</p>
          </div>
        )}
      </Carte>

      <Carte titre="Comptes existants" sousTitre="Administrateurs et lecteurs ayant accès au dashboard">
        {listeChargement && <Chargement />}
        {listeErreur && <Erreur msg={listeErreur} />}
        {liste && (
          <div className="overflow-x-auto -mx-5 lg:-mx-6">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50/60 border-y border-slate-200">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Compte</th>
                  <th className="text-left px-3 py-3 font-semibold">Rôle</th>
                  <th className="text-left px-3 py-3 font-semibold">Statut</th>
                  <th className="text-left px-3 py-3 font-semibold">Invité par</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-5 lg:px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {initialesEmail(a.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{a.email}</div>
                          <div className="text-xs text-slate-500">{new Date(a.date_creation).toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {a.is_founder
                        ? <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">Admin</span>
                        : a.role === 'admin'
                        ? <span className="text-xs font-medium bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">Admin</span>
                        : <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">Lecteur</span>}
                    </td>
                    <td className="px-3 py-3">
                      {a.active
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Actif</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />En attente</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 truncate max-w-[200px]">{a.invite_par_email || '—'}</td>
                    <td className="px-5 lg:px-6 py-3 text-right">
                      {!a.is_founder && a.id !== moiId && (
                        <button onClick={() => revoquer(a.id, a.email)} className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg px-2.5 py-1.5 transition-colors">
                          <Trash2 className="w-3 h-3" />Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </div>
  );
}
