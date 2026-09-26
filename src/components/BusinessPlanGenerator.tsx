import React, { useState, useEffect } from 'react';
import { X, FileText, Calculator, CalendarDays, Landmark, Download, Plus, Trash2, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { JOURS_PAR_MOIS_DEFAUT, projeter } from '../utils/projectionBP';

interface BusinessPlanGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  area: any | null;
  config: any | null; // Reçoit la configuration (ex: DERMATO_CONFIG)
}

const formatDH = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
const formatHT = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const TVA_MATERIEL = 0.20;
const arrondi2 = (n: number) => Math.round(n * 100) / 100;
const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function BusinessPlanGenerator({ isOpen, onClose, area, config }: BusinessPlanGeneratorProps) {
  // --- ÉTATS DYNAMIQUES PRINCIPAUX ---
  const [surface, setSurface] = useState<number>(0);
  const [typeOccupation, setTypeOccupation] = useState<'achat' | 'location'>('achat');
  
  // États initialisés à vide, remplis par le useEffect
  const [amenagements, setAmenagements] = useState<any[]>([]);
  const [newAmenagementNom, setNewAmenagementNom] = useState('');
  const [newAmenagementPrix, setNewAmenagementPrix] = useState('');

  const [effectifs, setEffectifs] = useState<any[]>([]);
  const [newEffectifNom, setNewEffectifNom] = useState('');
  const [newEffectifQte, setNewEffectifQte] = useState('');
  const [newEffectifSalaire, setNewEffectifSalaire] = useState('');

  const [machines, setMachines] = useState<any[]>([]);
  // Les prix des machines sont toujours stockés HT (tout le calcul en aval part du HT) ; ce choix ne
  // change que la saisie et l'affichage : en TTC, on affiche HT × (1 + TVA) et on convertit à la saisie.
  const [equipementTTC, setEquipementTTC] = useState<boolean>(false);
  const [newMachineNom, setNewMachineNom] = useState('');
  const [newMachinePrix, setNewMachinePrix] = useState('');

  const [actes, setActes] = useState<any[]>([]);
  const [newActeNom, setNewActeNom] = useState('');
  const [newActeNbrJour, setNewActeNbrJour] = useState('');
  const [newActePrixUnitaire, setNewActePrixUnitaire] = useState('');

  // Programme d'investissement et plan de financement — éditables (auparavant figés : frais
  // préliminaires et BFR ignoraient la config, apport/crédit codés en dur à 11 %/89 %).
  const [fraisPreliminaires, setFraisPreliminaires] = useState<number>(0);
  const [bfr, setBfr] = useState<number>(0);
  const [pourcentApport, setPourcentApport] = useState<number>(11);

  // Indice foncier (prix d'achat ou loyer au m²) — figé sur la valeur de la zone par défaut, mais
  // modifiable : ces prix sont des estimations de marché, pas des constantes, et c'est justement
  // ce qui détermine "Achat du Local" dans le programme d'investissement plus bas.
  const [prixM2, setPrixM2] = useState<number>(0);
  const [loyerM2Etat, setLoyerM2Etat] = useState<number>(0);

  // --- COMPTE DE PRODUITS ET CHARGES (CPC) ---
  // Régime fiscal : une profession libérale réglementée (médecin exerçant en son nom) est exclue
  // du régime simplifié CPU et relève de l'IR au barème progressif (RNR) ; une structure en
  // société (typiquement Clinique Privée) relève de l'IS. Pré-rempli selon la spécialité, mais
  // librement modifiable — c'est une donnée juridique propre à chaque projet, pas déductible du
  // seul nom de la spécialité.
  const [regimeFiscal, setRegimeFiscal] = useState<'IR' | 'IS'>('IR');
  // Charges d'exploitation récurrentes (fournitures, électricité, assurance, comptabilité...) —
  // aucune valeur par défaut n'est avancée ici : contrairement aux aménagements/machines (issus
  // d'une recherche de marché par spécialité), ces montants n'ont pas de source fiable générique ;
  // la liste part vide, à remplir avec des montants réels.
  const [chargesExternes, setChargesExternes] = useState<{ id: number; nom: string; montant: number }[]>([]);
  const [newChargeNom, setNewChargeNom] = useState('');
  const [newChargeMontant, setNewChargeMontant] = useState('');
  // Taux d'amortissement fiscalement admis (CGI marocain) : 10 %/10 ans pour les
  // agencements-aménagements est un taux usuel bien documenté ; pour le matériel médical, le CGI
  // ne publie pas de taux dédié (catégorie générale "matériel et outillage", 10 à 20 % admis selon
  // durée de vie justifiée) — 15 % est un point de départ raisonnable, à ajuster avec un
  // expert-comptable si besoin.
  const [tauxAmortAmenagements, setTauxAmortAmenagements] = useState<number>(10);
  const [tauxAmortMateriel, setTauxAmortMateriel] = useState<number>(15);
  // Taux débiteur moyen réel pour un crédit à l'équipement au Maroc, enquête trimestrielle Bank
  // Al-Maghrib T2 2026 (source officielle, pas une estimation) — à remplacer par le taux réel
  // obtenu auprès de la banque si disponible.
  const [tauxInteretCredit, setTauxInteretCredit] = useState<number>(4.65);
  const [dureeCreditAnnees, setDureeCreditAnnees] = useState<number>(7);

  // --- PRÉVISIONNEL SUR 5 ANS ---
  // Calendrier : l'année 1 va du mois de démarrage au 31 décembre (exercice civil). Les jours
  // travaillés sont saisis mois par mois (25 par défaut = 300 j/an, l'ancienne base figée du
  // générateur) ; ceux des mois antérieurs au démarrage ne comptent que pour les années pleines.
  const [moisDemarrage, setMoisDemarrage] = useState<number>(1);
  const [anneeDemarrage, setAnneeDemarrage] = useState<number>(new Date().getFullYear());
  const [joursParMois, setJoursParMois] = useState<number[]>(() => new Array(12).fill(JOURS_PAR_MOIS_DEFAUT));
  // Évolutions annuelles à partir de l'année 2 (décision du tuteur : +5 % sur le CA comme sur les
  // charges), modifiables.
  const [croissanceCAPct, setCroissanceCAPct] = useState<number>(5);
  const [croissanceChargesPct, setCroissanceChargesPct] = useState<number>(5);

  // Synchronisation de la configuration entrante avec les états éditables
  useEffect(() => {
    if (config) {
      setAmenagements([...config.amenagements]);
      setEffectifs([...config.effectifs]);
      setMachines([...config.machines]);
      setActes([...config.actes]);
      setFraisPreliminaires(config.fraisPreliminaires || 5000);
      setBfr(config.bfr || 25000);
      setRegimeFiscal(config.categorieEtablissement === 'Clinique Privée' ? 'IS' : 'IR');
    }
  }, [config]);

  useEffect(() => {
    if (area) {
      setPrixM2(area.prixM2 || 10000);
      setLoyerM2Etat(area.loyerM2 || 65);
    }
  }, [area]);

  if (!isOpen || !area || !config) return null;

  // --- LOGIQUE D'AJOUT ET MODIFICATION ---
  const handleUpdateAmenagement = (id: number, field: 'nom' | 'prix', value: string | number) => setAmenagements(amenagements.map(a => a.id === id ? { ...a, [field]: value } : a));
  const handleRemoveAmenagement = (id: number) => setAmenagements(amenagements.filter(a => a.id !== id));
  const handleAddAmenagement = () => {
    if (newAmenagementNom && newAmenagementPrix) {
      setAmenagements([...amenagements, { id: Date.now(), nom: newAmenagementNom, prix: parseFloat(newAmenagementPrix) }]);
      setNewAmenagementNom(''); setNewAmenagementPrix('');
    }
  };

  const handleUpdateEffectif = (id: number, field: 'nom' | 'qte' | 'salaire', value: string | number) => setEffectifs(effectifs.map(e => e.id === id ? { ...e, [field]: value } : e));
  const handleRemoveEffectif = (id: number) => setEffectifs(effectifs.filter(e => e.id !== id));
  const handleAddEffectif = () => {
    if (newEffectifNom && newEffectifQte && newEffectifSalaire) {
      setEffectifs([...effectifs, { id: Date.now(), nom: newEffectifNom, qte: parseInt(newEffectifQte), salaire: parseFloat(newEffectifSalaire) }]);
      setNewEffectifNom(''); setNewEffectifQte(''); setNewEffectifSalaire('');
    }
  };

  const handleUpdateMachine = (id: number, field: 'nom' | 'prix', value: string | number) => setMachines(machines.map(m => m.id === id ? { ...m, [field]: value } : m));
  const handleRemoveMachine = (id: number) => setMachines(machines.filter(m => m.id !== id));
  const handleAddMachine = () => {
    if (newMachineNom && newMachinePrix) {
      const saisi = parseFloat(newMachinePrix);
      setMachines([...machines, { id: Date.now(), nom: newMachineNom.toUpperCase(), prix: equipementTTC ? saisi / (1 + TVA_MATERIEL) : saisi }]);
      setNewMachineNom(''); setNewMachinePrix('');
    }
  };

  const handleUpdateActe = (id: number, field: 'nom' | 'nbrJour' | 'prixUnitaire', value: string | number) => setActes(actes.map(a => a.id === id ? { ...a, [field]: value } : a));
  const handleRemoveActe = (id: number) => setActes(actes.filter(a => a.id !== id));
  const handleAddActe = () => {
    if (newActeNom && newActeNbrJour && newActePrixUnitaire) {
      setActes([...actes, { id: Date.now(), type: null, nom: newActeNom, nbrJour: parseFloat(newActeNbrJour), prixUnitaire: parseFloat(newActePrixUnitaire) }]);
      setNewActeNom(''); setNewActeNbrJour(''); setNewActePrixUnitaire('');
    }
  };

  const handleUpdateCharge = (id: number, field: 'nom' | 'montant', value: string | number) => setChargesExternes(chargesExternes.map(c => c.id === id ? { ...c, [field]: value } : c));
  const handleRemoveCharge = (id: number) => setChargesExternes(chargesExternes.filter(c => c.id !== id));
  const handleAddCharge = () => {
    if (newChargeNom && newChargeMontant) {
      setChargesExternes([...chargesExternes, { id: Date.now(), nom: newChargeNom, montant: parseFloat(newChargeMontant) }]);
      setNewChargeNom(''); setNewChargeMontant('');
    }
  };

  // --- CALCULS MATHÉMATIQUES GLOBAUX ---
  const surfaceInitiale = config.surfaceDefaut || 80;

  const baseAmenagementHT = amenagements.reduce((acc, curr) => acc + curr.prix, 0);
  // Corrigé : comparait auparavant à 80m² en dur, quelle que soit la surface par défaut réelle de
  // la spécialité (config.surfaceDefaut) — un surcoût apparaissait à tort dès que la surface
  // différait de 80m², même pour une spécialité dont la surface par défaut est différente.
  const surcoutSurfaceHT = (surface - surfaceInitiale) * 1500;
  const totalAmenagementHT = baseAmenagementHT + surcoutSurfaceHT;
  const totalAmenagementTTC = totalAmenagementHT * 1.20;

  const masseSalariale = effectifs.reduce((acc, curr) => acc + (curr.qte * curr.salaire), 0);

  const totalMaterielHT = machines.reduce((acc, curr) => acc + curr.prix, 0);
  const tvaMateriel = totalMaterielHT * TVA_MATERIEL;
  const totalMaterielTTC = totalMaterielHT + tvaMateriel;

  // prixM2/loyerM2Etat : états éditables (voir plus haut), initialisés depuis area mais
  // ajustables — c'est ce qui permet de modifier "Achat du Local" / "Frais d'installation".
  const loyerMensuel = surface * loyerM2Etat;
  const investissementFoncier = typeOccupation === 'achat' ? surface * prixM2 : loyerMensuel * 4;

  // Initialisation de la surface une seule fois au chargement
  useEffect(() => {
    if (config) setSurface(config.surfaceDefaut || 80);
  }, [config]);

  const totalInvestissement = fraisPreliminaires + investissementFoncier + totalAmenagementTTC + totalMaterielTTC + bfr + masseSalariale;
  const apportPersonnel = totalInvestissement * (pourcentApport / 100);
  const creditSollicite = totalInvestissement - apportPersonnel;

  const totalCAJour = actes.reduce((acc, acte) => acc + (acte.nbrJour * acte.prixUnitaire), 0);
  const joursAnneePleine = joursParMois.reduce((acc, j) => acc + j, 0);
  const totalCAAnnee = totalCAJour * joursAnneePleine; // année pleine ; l'année 1 réelle dépend du mois de démarrage

  // --- COMPTE DE PRODUITS ET CHARGES (CPC) ---
  const totalChargesExternes = chargesExternes.reduce((acc, c) => acc + c.montant, 0);
  // Barème IR 2026 (officiel, source DGI) — profession libérale réglementée au régime RNR.
  const BAREME_IR_2026 = [
    { max: 40000, taux: 0, deduire: 0 },
    { max: 60000, taux: 0.10, deduire: 4000 },
    { max: 80000, taux: 0.20, deduire: 10000 },
    { max: 100000, taux: 0.30, deduire: 18000 },
    { max: 180000, taux: 0.34, deduire: 22000 },
    { max: Infinity, taux: 0.37, deduire: 27400 },
  ];
  const calculerIR = (rni: number): number => {
    if (rni <= 0) return 0;
    const tranche = BAREME_IR_2026.find((t) => rni <= t.max)!;
    return Math.max(0, rni * tranche.taux - tranche.deduire);
  };
  // IS 2026 : taux unique 20 % (convergence LF2023 achevée) + Contribution Sociale de Solidarité
  // (CSS) au-delà de 1M DH de bénéfice net fiscal — ne concerne en pratique que Clinique Privée.
  const calculerIS = (benefice: number): number => {
    if (benefice <= 0) return 0;
    const is = benefice * 0.20;
    let tauxCSS = 0;
    if (benefice > 40000000) tauxCSS = 0.05;
    else if (benefice > 10000000) tauxCSS = 0.035;
    else if (benefice > 5000000) tauxCSS = 0.025;
    else if (benefice > 1000000) tauxCSS = 0.015;
    return is + benefice * tauxCSS;
  };

  // Prévisionnel sur 5 exercices civils (calcul dans utils/projectionBP.ts, testé). Amortissement
  // calculé sur la base TTC : les actes médicaux sont exonérés de TVA (art. 91 CGI), la TVA payée
  // sur aménagements/matériel n'est donc jamais récupérable et fait partie intégrante du coût à
  // amortir — ce n'est pas une approximation, c'est la conséquence directe de l'exonération.
  const projection = projeter({
    caParJour: totalCAJour,
    joursParMois,
    moisDemarrage,
    anneeDemarrage,
    croissanceCA: croissanceCAPct / 100,
    croissanceCharges: croissanceChargesPct / 100,
    chargesExternesAnnuelles: totalChargesExternes,
    loyerMensuel: typeOccupation === 'location' ? loyerMensuel : 0,
    masseSalarialeMensuelle: masseSalariale,
    baseAmortAmenagements: totalAmenagementTTC,
    tauxAmortAmenagements,
    baseAmortMateriel: totalMaterielTTC,
    tauxAmortMateriel,
    credit: creditSollicite,
    tauxCreditPct: tauxInteretCredit,
    dureeCreditAnnees,
    calculerImpot: regimeFiscal === 'IR' ? calculerIR : calculerIS,
  });
  // Lignes de report affichées seulement quand un déficit existe (sinon résultat imposable = résultat avant impôt).
  const avecReportDeficit = projection.some((l) => l.resultatAvantImpot < 0 || l.deficitImpute > 0);
  const donneesGraphique = projection.map((l) => ({
    annee: String(l.annee),
    "Chiffre d'affaires": Math.round(l.ca),
    'Charges totales': Math.round(l.chargesExternes + l.loyer + l.personnel + l.dotations + l.interets),
    'Résultat net': Math.round(l.resultatNet),
  }));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 print:p-0 print:static">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm print:hidden" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-6xl bg-white text-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[95vh] print:h-auto print:shadow-none print:rounded-none">
        
        {/* EN-TÊTE */}
        <div className="flex justify-between items-center p-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3"><FileText className="h-6 w-6 text-blue-400" /><h2 className="text-lg font-black uppercase tracking-wide">{config.titre}</h2></div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors"><Printer className="h-4 w-4" /> PDF</button>
            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-rose-600 rounded-full transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* CORPS */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 print:p-0 bg-slate-50">
          <div className="text-center mb-10 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-black uppercase mb-2 tracking-tight">Étude de Faisabilité et Business Plan</h1>
            <p className="text-lg font-bold text-blue-700 uppercase">{config.specialiteNom} • {area.nom}</p>
          </div>

          {/* PARAMÈTRES */}
          <div className="mb-10 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2"><Calculator className="h-5 w-5 text-blue-600" /> Ajustements Généraux</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Mode d'Occupation</label>
                <select value={typeOccupation} onChange={(e) => setTypeOccupation(e.target.value as 'achat' | 'location')} className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="achat">Achat Foncier</option>
                  <option value="location">Location Mensuelle</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Surface (m²)</label>
                <input type="number" value={surface} onChange={(e) => setSurface(Number(e.target.value))} className="w-28 px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{typeOccupation === 'achat' ? 'Prix au m² (Achat)' : 'Loyer au m²/mois'}</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500">
                  {typeOccupation === 'achat' ? (
                    <input type="number" value={prixM2} onChange={(e) => setPrixM2(Number(e.target.value) || 0)} className="w-24 bg-transparent font-black text-blue-700 text-lg outline-none text-center" />
                  ) : (
                    <input type="number" value={loyerM2Etat} onChange={(e) => setLoyerM2Etat(Number(e.target.value) || 0)} className="w-24 bg-transparent font-black text-blue-700 text-lg outline-none text-center" />
                  )}
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">DH/m²{typeOccupation === 'location' ? '/mois' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CALENDRIER D'EXPLOITATION (mois de démarrage, jours travaillés) */}
            <div className="mb-10 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden" id="bp-calendrier">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-600" /> Calendrier d'exploitation</h3>
              <div className="flex flex-wrap items-end gap-6 mb-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="bp-mois-demarrage" className="text-[10px] font-bold text-slate-500 uppercase">Mois de démarrage</label>
                  <select id="bp-mois-demarrage" value={moisDemarrage} onChange={(e) => setMoisDemarrage(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {NOMS_MOIS.map((nom, i) => <option key={nom} value={i + 1}>{nom}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="bp-annee-demarrage" className="text-[10px] font-bold text-slate-500 uppercase">Année de démarrage</label>
                  <input id="bp-annee-demarrage" type="number" value={anneeDemarrage} onChange={(e) => setAnneeDemarrage(Math.round(Number(e.target.value)) || new Date().getFullYear())} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="bp-jours-tous" className="text-[10px] font-bold text-slate-500 uppercase">Jours travaillés / mois (tous les mois)</label>
                  <input id="bp-jours-tous" type="number" min={0} max={31} placeholder="ex. 22" onChange={(e) => { const v = Math.min(31, Math.max(0, parseFloat(e.target.value))); if (!Number.isNaN(v)) setJoursParMois(new Array(12).fill(v)); }} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {NOMS_MOIS.map((nom, i) => {
                  const avantDemarrage = i + 1 < moisDemarrage;
                  return (
                    <div key={nom} className={`flex flex-col gap-1 ${avantDemarrage ? 'opacity-50' : ''}`} title={avantDemarrage ? "Avant le démarrage : ne compte qu'à partir de l'année suivante" : undefined}>
                      <label htmlFor={`bp-jours-${i + 1}`} className="text-[10px] font-bold text-slate-500 uppercase text-center">{nom.slice(0, 4)}.</label>
                      <input id={`bp-jours-${i + 1}`} type="number" min={0} max={31} value={joursParMois[i]} onChange={(e) => { const v = Math.min(31, Math.max(0, parseFloat(e.target.value) || 0)); setJoursParMois(joursParMois.map((j, k) => (k === i ? v : j))); }} className="w-full px-1 py-2 bg-slate-50 border border-slate-300 rounded-lg font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-slate-400 italic">Jours travaillés en année pleine : {joursAnneePleine}. Les mois grisés précèdent le démarrage : ils ne comptent pas en {anneeDemarrage} mais reviennent dans les années suivantes.</p>
            </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-10">
            {/* AMÉNAGEMENTS */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">I. Aménagements<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
                <thead><tr className="bg-slate-100"><th className="border border-slate-300 p-2 text-left">Désignation</th><th className="border border-slate-300 p-2 text-right w-24">Prix (DH)</th><th className="border border-slate-300 p-2 w-8 print:hidden"></th></tr></thead>
                <tbody>
                  {amenagements.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-2"><input type="text" value={a.nom} onChange={(e) => handleUpdateAmenagement(a.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium outline-none print:border-none" /></td>
                      <td className="border border-slate-300 p-2"><input type="number" value={a.prix} onChange={(e) => handleUpdateAmenagement(a.id, 'prix', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-bold text-slate-800 outline-none print:border-none appearance-none" /></td>
                      <td className="border border-slate-300 p-1 text-center print:hidden"><button onClick={() => handleRemoveAmenagement(a.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                    </tr>
                  ))}
                  <tr className="print:hidden bg-blue-50/30">
                    <td className="border border-slate-300 p-1"><input type="text" placeholder="Ajouter un aménagement..." value={newAmenagementNom} onChange={(e) => setNewAmenagementNom(e.target.value)} className="w-full p-1 text-xs" /></td>
                    <td className="border border-slate-300 p-1"><input type="number" placeholder="Prix" value={newAmenagementPrix} onChange={(e) => setNewAmenagementPrix(e.target.value)} className="w-full p-1 text-xs text-right" /></td>
                    <td className="border border-slate-300 p-1 text-center"><button onClick={handleAddAmenagement} className="bg-blue-600 text-white p-1.5 rounded"><Plus className="h-3 w-3 mx-auto" /></button></td>
                  </tr>
                  {surface !== surfaceInitiale && (
                    <tr className="bg-blue-50/50"><td className="border border-slate-300 p-2 text-blue-700 font-medium">Ajustement surface ({surface} m² vs {surfaceInitiale} m² référence)</td><td className="border border-slate-300 p-2 text-right font-bold text-blue-700">{formatHT(surcoutSurfaceHT)}</td><td className="border border-slate-300 print:hidden"></td></tr>
                  )}
                  <tr className="bg-slate-900 text-white"><td className="border border-slate-900 p-2 text-right font-black">PT TTC Aménagement :</td><td className="border border-slate-900 p-2 text-right font-black text-sm" colSpan={2}>{formatHT(totalAmenagementTTC)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* EFFECTIFS */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">II. Effectifs<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
                <thead><tr className="bg-slate-100"><th className="border p-2 text-left">Poste</th><th className="border p-2 text-center w-12">Qté</th><th className="border p-2 text-right w-24">Salaire</th><th className="border p-2 w-8 print:hidden"></th></tr></thead>
                <tbody>
                  {effectifs.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="border p-2"><input type="text" value={e.nom} onChange={(evt) => handleUpdateEffectif(e.id, 'nom', evt.target.value)} className="w-full bg-transparent font-medium outline-none print:border-none" /></td>
                      <td className="border p-2"><input type="number" value={e.qte} onChange={(evt) => handleUpdateEffectif(e.id, 'qte', parseFloat(evt.target.value) || 0)} className="w-full text-center font-bold outline-none print:border-none" /></td>
                      <td className="border p-2"><input type="number" value={e.salaire} onChange={(evt) => handleUpdateEffectif(e.id, 'salaire', parseFloat(evt.target.value) || 0)} className="w-full text-right font-bold outline-none print:border-none" /></td>
                      <td className="border p-1 text-center print:hidden"><button onClick={() => handleRemoveEffectif(e.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                    </tr>
                  ))}
                  <tr className="print:hidden bg-blue-50/30">
                    <td className="border border-slate-300 p-1"><input type="text" placeholder="Ajouter un poste..." value={newEffectifNom} onChange={(e) => setNewEffectifNom(e.target.value)} className="w-full p-1 text-xs" /></td>
                    <td className="border border-slate-300 p-1"><input type="number" placeholder="Qté" value={newEffectifQte} onChange={(e) => setNewEffectifQte(e.target.value)} className="w-full p-1 text-xs text-center" /></td>
                    <td className="border border-slate-300 p-1"><input type="number" placeholder="Salaire" value={newEffectifSalaire} onChange={(e) => setNewEffectifSalaire(e.target.value)} className="w-full p-1 text-xs text-right" /></td>
                    <td className="border border-slate-300 p-1 text-center"><button onClick={handleAddEffectif} className="bg-blue-600 text-white p-1.5 rounded"><Plus className="h-3 w-3 mx-auto" /></button></td>
                  </tr>
                  <tr className="bg-slate-100"><td colSpan={2} className="border p-2 font-black text-right">Provision Mensuelle :</td><td className="border p-2 text-right font-black text-blue-700" colSpan={2}>{formatHT(masseSalariale)} DH</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MATÉRIEL MÉDICAL MODIFIABLE */}
          <div className="mb-12 page-break-inside-avoid">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">III. Équipement & Spécialités<span className="flex items-center gap-3 print:hidden"><span className="text-[10px] font-normal text-slate-500 uppercase">Prix saisis</span><span className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-[11px] font-black"><button type="button" id="bp-equip-ht" aria-pressed={!equipementTTC} onClick={() => setEquipementTTC(false)} className={`px-3 py-1.5 ${!equipementTTC ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Hors taxe</button><button type="button" id="bp-equip-ttc" aria-pressed={equipementTTC} onClick={() => setEquipementTTC(true)} className={`px-3 py-1.5 ${equipementTTC ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>TTC (TVA 20 %)</button></span></span></h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead><tr className="bg-slate-100"><th className="border p-3 text-left">Équipement</th><th className="border p-3 text-right w-40">{equipementTTC ? 'Montant TTC (DH)' : 'Montant HT (DH)'}</th><th className="border p-3 w-12 print:hidden">X</th></tr></thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="border p-2"><input type="text" value={m.nom} onChange={(e) => handleUpdateMachine(m.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium text-slate-800 outline-none print:border-none" /></td>
                    <td className="border p-2"><input type="number" value={arrondi2(equipementTTC ? m.prix * (1 + TVA_MATERIEL) : m.prix)} onChange={(e) => { const saisi = parseFloat(e.target.value) || 0; handleUpdateMachine(m.id, 'prix', equipementTTC ? saisi / (1 + TVA_MATERIEL) : saisi); }} className="w-full bg-transparent text-right font-bold outline-none print:border-none appearance-none" /></td>
                    <td className="border p-2 text-center print:hidden"><button onClick={() => handleRemoveMachine(m.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                  </tr>
                ))}
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border p-2"><input type="text" placeholder="Ajouter une machine..." value={newMachineNom} onChange={(e) => setNewMachineNom(e.target.value)} className="w-full border p-2 text-xs rounded" /></td>
                  <td className="border p-2"><input type="number" placeholder={equipementTTC ? 'Prix TTC' : 'Prix HT'} value={newMachinePrix} onChange={(e) => setNewMachinePrix(e.target.value)} className="w-full border p-2 text-xs text-right rounded" /></td>
                  <td className="border p-2 text-center"><button onClick={handleAddMachine} className="bg-blue-600 text-white p-2 rounded w-full"><Plus className="h-4 w-4 mx-auto" /></button></td>
                </tr>
                <tr className="bg-slate-100"><td className="border p-3 text-right font-bold text-slate-700">Total HT :</td><td className="border p-3 text-right font-bold text-slate-700" colSpan={2}>{formatHT(totalMaterielHT)}</td></tr>
                <tr className="bg-slate-100"><td className="border p-3 text-right font-bold text-slate-700">TVA (20 %) :</td><td className="border p-3 text-right font-bold text-slate-700" colSpan={2}>{formatHT(tvaMateriel)}</td></tr>
                <tr className="bg-slate-900 text-white"><td className="border p-3 text-right font-black">PT TTC (TVA 20%) :</td><td className="border p-3 text-right font-black text-lg" colSpan={2}>{formatHT(totalMaterielTTC)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* EXPLOITATION PRÉVISIONNELLE */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">IV. Chiffre d'Affaires Prévisionnel<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead><tr className="bg-slate-100"><th className="border p-3 text-left">Nature des actes</th><th className="border p-3 text-center">Actes/Jour</th><th className="border p-3 text-center">Tarif Moyen (DH)</th><th className="border p-3 text-right">CA Quotidien</th><th className="border p-3 w-8 print:hidden"></th></tr></thead>
              <tbody>
                {actes.map(acte => (
                  <tr key={acte.id} className="hover:bg-slate-50">
                    <td className="border p-2"><input type="text" value={acte.nom} onChange={(e) => handleUpdateActe(acte.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium text-slate-700 outline-none print:border-none" /></td>
                    <td className="border p-2"><input type="number" value={acte.nbrJour} onChange={(e) => handleUpdateActe(acte.id, 'nbrJour', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none text-blue-700" /></td>
                    <td className="border p-2"><input type="number" value={acte.prixUnitaire} onChange={(e) => handleUpdateActe(acte.id, 'prixUnitaire', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none" /></td>
                    <td className="border p-3 text-right font-bold text-slate-900">{formatHT(acte.nbrJour * acte.prixUnitaire)}</td>
                    <td className="border p-1 text-center print:hidden"><button onClick={() => handleRemoveActe(acte.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                  </tr>
                ))}
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border p-2"><input type="text" placeholder="Ajouter un acte..." value={newActeNom} onChange={(e) => setNewActeNom(e.target.value)} className="w-full p-1 text-xs" /></td>
                  <td className="border p-2"><input type="number" placeholder="Actes/jour" value={newActeNbrJour} onChange={(e) => setNewActeNbrJour(e.target.value)} className="w-full p-1 text-xs text-center" /></td>
                  <td className="border p-2"><input type="number" placeholder="Tarif" value={newActePrixUnitaire} onChange={(e) => setNewActePrixUnitaire(e.target.value)} className="w-full p-1 text-xs text-center" /></td>
                  <td className="border p-2"></td>
                  <td className="border p-2 text-center"><button onClick={handleAddActe} className="bg-blue-600 text-white p-1.5 rounded"><Plus className="h-3 w-3 mx-auto" /></button></td>
                </tr>
                <tr className="bg-blue-50/50"><td className="border p-3 font-black text-right" colSpan={3}>TOTAL CA / JOUR :</td><td className="border p-3 font-black text-right text-lg text-blue-700" colSpan={2}>{formatHT(totalCAJour)} DH</td></tr>
                <tr className="bg-slate-900 text-white"><td className="border p-4 font-black text-right" colSpan={3}>CA ANNUEL (année pleine, {joursAnneePleine} jours) :</td><td className="border p-4 font-black text-right text-xl" colSpan={2}>{formatHT(totalCAAnnee)} DH</td></tr>
              </tbody>
            </table>
          </div>

          {/* INVESTISSEMENT ET FINANCEMENT */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">V. Programme d'Investissement & Financement<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <table className="w-full text-xs border-collapse bg-white shadow-sm">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={2}>Investissement (TTC)</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="border p-3 font-medium">Frais Préliminaires</td>
                    <td className="border p-1 text-right">
                      <input type="number" value={fraisPreliminaires} onChange={(e) => setFraisPreliminaires(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-black p-2 outline-none print:border-none appearance-none" />
                    </td>
                  </tr>
                  <tr className="bg-blue-50/40">
                    <td className="border p-3 font-bold text-blue-900">{typeOccupation === 'achat' ? `Achat du Local (${surface}m²)` : `Frais d'installation (${surface}m² - Caution+Agence)`}</td>
                    <td className="border p-1 text-right">
                      <input
                        type="number"
                        value={Math.round(investissementFoncier)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          // Repasse par prixM2/loyerM2Etat plutôt qu'un état séparé, pour que ce
                          // montant reste toujours cohérent avec le champ "Prix au m²" des
                          // Ajustements Généraux (les deux modifient la même donnée sous-jacente).
                          if (typeOccupation === 'achat') setPrixM2(surface > 0 ? Math.round(val / surface) : 0);
                          else setLoyerM2Etat(surface > 0 ? Math.round(val / (surface * 4)) : 0);
                        }}
                        className="w-full bg-transparent text-right font-black text-blue-700 p-2 outline-none print:border-none appearance-none"
                      />
                    </td>
                  </tr>
                  <tr><td className="border p-3 font-medium">Aménagements et Installations</td><td className="border p-3 text-right font-black">{formatHT(totalAmenagementTTC)}</td></tr>
                  <tr><td className="border p-3 font-medium">Matériels & Équipements Lasers</td><td className="border p-3 text-right font-black">{formatHT(totalMaterielTTC)}</td></tr>
                  <tr>
                    <td className="border p-3 font-medium">Fonds de Roulement (Produits HN)</td>
                    <td className="border p-1 text-right">
                      <input type="number" value={bfr} onChange={(e) => setBfr(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-black p-2 outline-none print:border-none appearance-none" />
                    </td>
                  </tr>
                  <tr><td className="border p-3 font-medium">Masse Salariale (1er mois)</td><td className="border p-3 text-right font-black">{formatHT(masseSalariale)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase">Total Investissement</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse bg-white shadow-sm h-fit">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={3}>Plan de Financement</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="border p-4 font-medium">Apport Personnel</td>
                    <td className="border p-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pourcentApport}
                          onChange={(e) => setPourcentApport(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-12 bg-transparent text-center font-black p-1 outline-none print:border-none appearance-none"
                        />
                        <span className="font-black">%</span>
                      </div>
                    </td>
                    <td className="border p-4 text-right font-black text-emerald-600 text-sm">{formatDH(apportPersonnel)}</td>
                  </tr>
                  <tr>
                    <td className="border p-4 font-medium">Crédit Sollicité</td>
                    <td className="border p-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={100 - pourcentApport}
                          onChange={(e) => setPourcentApport(100 - Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-12 bg-transparent text-center font-black p-1 outline-none print:border-none appearance-none"
                        />
                        <span className="font-black">%</span>
                      </div>
                    </td>
                    <td className="border p-4 text-right font-black text-rose-600 text-sm">{formatDH(creditSollicite)}</td>
                  </tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase">Total Financement</td><td className="border p-4 text-center font-black">100 %</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 italic print:hidden">
              "Aménagements", "Matériels" et "Masse Salariale" ne sont pas des cases à remplir : ce sont les totaux des tableaux I, II et III ci-dessus, mis à jour automatiquement quand vous les modifiez là-bas. Les 2 lignes "Total" font pareil avec tout le tableau. Tout le reste (frais préliminaires, achat du local, fonds de roulement, % apport/crédit) se modifie directement ici.
            </p>
            
            <div className="mt-6 p-5 bg-[#fffdf0] border border-[#f5e3a8] rounded-xl flex items-start gap-4 print:hidden shadow-sm">
              <Landmark className="h-8 w-8 text-[#d4af37] shrink-0" />
              <div>
                <h4 className="font-black text-[#856614] text-lg leading-tight mb-1">Demande de Financement</h4>
                <p className="text-sm text-[#a3801f]">Enregistrez ce PDF pour le transmettre à la banque concernant le crédit de <strong className="font-black">{formatDH(creditSollicite)}</strong> pour votre projet.</p>
              </div>
            </div>
          </div>

          {/* COMPTE DE PRODUITS ET CHARGES */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">VI. Compte de Produits et Charges (CPC)<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>

            {/* Hypothèses fiscales et financières */}
            <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Hypothèses (régime fiscal, amortissements, crédit)</h4>
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Régime fiscal</label>
                  <select value={regimeFiscal} onChange={(e) => setRegimeFiscal(e.target.value as 'IR' | 'IS')} className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="IR">IR — barème progressif (profession libérale, RNR)</option>
                    <option value="IS">IS — 20 % (société)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Amort. Aménagements (%/an)</label>
                  <input type="number" step="0.5" value={tauxAmortAmenagements} onChange={(e) => setTauxAmortAmenagements(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Amort. Matériel (%/an)</label>
                  <input type="number" step="0.5" value={tauxAmortMateriel} onChange={(e) => setTauxAmortMateriel(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="bp-croissance-ca" className="text-[10px] font-bold text-slate-500 uppercase">Croissance CA (%/an)</label>
                  <input id="bp-croissance-ca" type="number" step="0.5" value={croissanceCAPct} onChange={(e) => setCroissanceCAPct(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="bp-croissance-charges" className="text-[10px] font-bold text-slate-500 uppercase">Hausse des charges (%/an)</label>
                  <input id="bp-croissance-charges" type="number" step="0.5" value={croissanceChargesPct} onChange={(e) => setCroissanceChargesPct(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Taux crédit (%/an)</label>
                  <input type="number" step="0.05" value={tauxInteretCredit} onChange={(e) => setTauxInteretCredit(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Durée crédit (ans)</label>
                  <input type="number" value={dureeCreditAnnees} onChange={(e) => setDureeCreditAnnees(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-400 italic">
                Valeurs pré-remplies ci-dessus, modifiables librement — sources : amort. aménagements 10 %/an (taux CGI usuel) ; amort. matériel 15 %/an (catégorie générale CGI "matériel et outillage", 10-20 % admis — à confirmer avec un expert-comptable, aucun taux spécifique publié pour le matériel médical) ; taux crédit 4,65 % (taux débiteur moyen réel du crédit équipement, enquête Bank Al-Maghrib T2 2026, remplacez par le taux de votre banque si différent). Régime IR = barème progressif marocain 2026 ; régime IS = 20 % (+ CSS au-delà de 1M DH de bénéfice).
              </p>
            </div>

            {/* Charges externes */}
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white mb-6">
              <thead><tr className="bg-slate-100"><th className="border border-slate-300 p-2 text-left">Charges Externes (fournitures, électricité, assurance, comptabilité...)</th><th className="border border-slate-300 p-2 text-right w-24">Montant/an (DH)</th><th className="border border-slate-300 p-2 w-8 print:hidden"></th></tr></thead>
              <tbody>
                {chargesExternes.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 p-2"><input type="text" value={c.nom} onChange={(e) => handleUpdateCharge(c.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium outline-none print:border-none" /></td>
                    <td className="border border-slate-300 p-2"><input type="number" value={c.montant} onChange={(e) => handleUpdateCharge(c.id, 'montant', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-bold text-slate-800 outline-none print:border-none appearance-none" /></td>
                    <td className="border border-slate-300 p-1 text-center print:hidden"><button onClick={() => handleRemoveCharge(c.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                  </tr>
                ))}
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border border-slate-300 p-1"><input type="text" placeholder="Ajouter une charge (ex: Fournitures médicales)..." value={newChargeNom} onChange={(e) => setNewChargeNom(e.target.value)} className="w-full p-1 text-xs" /></td>
                  <td className="border border-slate-300 p-1"><input type="number" placeholder="Montant/an" value={newChargeMontant} onChange={(e) => setNewChargeMontant(e.target.value)} className="w-full p-1 text-xs text-right" /></td>
                  <td className="border border-slate-300 p-1 text-center"><button onClick={handleAddCharge} className="bg-blue-600 text-white p-1.5 rounded"><Plus className="h-3 w-3 mx-auto" /></button></td>
                </tr>
                {chargesExternes.length === 0 && (
                  <tr><td colSpan={3} className="p-3 text-center text-slate-400 italic text-[11px]">Aucune charge saisie — ajoutez vos postes réels (aucun montant type n'est proposé par défaut).</td></tr>
                )}
              </tbody>
            </table>

            {/* CPC prévisionnel sur 5 exercices civils */}
            <div className="overflow-x-auto">
              <table id="bp-cpc-5ans" className="w-full text-xs border-collapse bg-white shadow-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="border p-3 text-left uppercase text-[10px] tracking-wider">CPC prévisionnel (DH)</th>
                    {projection.map((l) => (
                      <th key={l.rang} className="border p-3 text-right">
                        <div className="font-black">{l.annee}</div>
                        <div className="text-[9px] font-normal text-slate-300">{l.moisActifs < 12 ? `${l.moisActifs} mois` : 'année pleine'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-500"><td className="border p-3 italic">Jours travaillés</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right italic">{formatHT(l.joursTravailles)}</td>)}</tr>
                  <tr><td className="border p-3 font-bold text-slate-900">Chiffre d'Affaires</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-black text-emerald-700">{formatHT(l.ca)}</td>)}</tr>
                  <tr><td className="border p-3 pl-6 text-slate-600">− Charges Externes</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.chargesExternes)}</td>)}</tr>
                  {typeOccupation === 'location' && (
                    <tr><td className="border p-3 pl-6 text-slate-600">− Loyer</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.loyer)}</td>)}</tr>
                  )}
                  <tr><td className="border p-3 pl-6 text-slate-600">− Charges de Personnel</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.personnel)}</td>)}</tr>
                  <tr><td className="border p-3 pl-6 text-slate-600">− Dotations aux Amortissements</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.dotations)}</td>)}</tr>
                  <tr className="bg-slate-100"><td className="border p-3 font-black uppercase">Résultat d'Exploitation</td>{projection.map((l) => <td key={l.rang} className={`border p-3 text-right font-black ${l.resultatExploitation >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatHT(l.resultatExploitation)}</td>)}</tr>
                  <tr><td className="border p-3 pl-6 text-slate-600">− Charges Financières (intérêts du crédit)</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.interets)}</td>)}</tr>
                  <tr className="bg-slate-100"><td className="border p-3 font-black uppercase">Résultat Avant Impôt</td>{projection.map((l) => <td key={l.rang} className={`border p-3 text-right font-black ${l.resultatAvantImpot >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatHT(l.resultatAvantImpot)}</td>)}</tr>
                  {avecReportDeficit && (
                    <>
                      <tr><td className="border p-3 pl-6 text-slate-600">− Déficits des années précédentes imputés</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-slate-600">{formatHT(l.deficitImpute)}</td>)}</tr>
                      <tr className="bg-slate-50"><td className="border p-3 font-bold text-slate-700">Résultat imposable</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-bold text-slate-700">{formatHT(l.resultatImposable)}</td>)}</tr>
                    </>
                  )}
                  <tr><td className="border p-3 pl-6 text-slate-600">− Impôt ({regimeFiscal === 'IR' ? 'IR, barème' : 'IS 20% + CSS'})</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right font-semibold text-rose-600">{formatHT(l.impot)}</td>)}</tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase">Résultat Net</td>{projection.map((l) => <td key={l.rang} className="border p-4 text-right font-black">{formatHT(l.resultatNet)}</td>)}</tr>
                  <tr className="text-slate-500"><td className="border p-3 italic">Capital du crédit remboursé (hors CPC)</td>{projection.map((l) => <td key={l.rang} className="border p-3 text-right italic">{formatHT(l.capitalRembourse)}</td>)}</tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-white border border-slate-200 rounded-xl" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={donneesGraphique} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} />
                  <RechartsTooltip formatter={(v: number) => `${formatHT(v)} DH`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Chiffre d'affaires" fill="#2563eb" isAnimationActive={false} />
                  <Bar dataKey="Charges totales" fill="#f43f5e" isAnimationActive={false} />
                  <Bar dataKey="Résultat net" fill="#10b981" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-2 text-[10px] text-slate-400 italic">
              Exercices civils : l'année {projection[0].annee} court du mois de démarrage au 31 décembre (personnel, charges, loyer et amortissements au prorata des mois). Les années suivantes sont des années pleines : chiffre d'affaires +{croissanceCAPct} % et charges (externes, personnel, loyer) +{croissanceChargesPct} % par an, à partir de la valeur annualisée de l'année 1. Amortissements linéaires, intérêts issus de l'échéancier mensuel du crédit. Un déficit est reporté et s'impute sur les bénéfices des années suivantes avant calcul de l'impôt (durée légale de report à confirmer avec un expert-comptable).
            </p>
          </div>

        </div>
      </motion.div>
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } .fixed { position: absolute; } .print\\:static { position: static !important; } .print\\:hidden { display: none !important; } .print\\:p-0 { padding: 0 !important; } .print\\:shadow-none { box-shadow: none !important; } .print\\:border-none { border: none !important; } .page-break-inside-avoid { page-break-inside: avoid; } .relative.w-full.max-w-6xl, .relative.w-full.max-w-6xl * { visibility: visible; } .relative.w-full.max-w-6xl { position: absolute; left: 0; top: 0; width: 100%; overflow: visible !important; height: auto !important; } }`}} />
    </div>
  );
}