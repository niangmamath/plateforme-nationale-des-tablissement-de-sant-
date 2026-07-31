import React, { useState } from 'react';
import { X, FileText, Calculator, Landmark, Plus, Trash2, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface AreaData {
  nom: string;
  ville: string;
  prixM2: number;
  population: number;
}

interface BusinessPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: AreaData | null;
  specialty: string | null;
}

const formatDH = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
const formatHT = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BusinessPlanClinique({ isOpen, onClose, area, specialty }: BusinessPlanModalProps) {
  // --- ÉTATS DYNAMIQUES (Échelle Clinique) ---
  const [surface, setSurface] = useState<number>(1500); // 1500 m² par défaut pour une petite polyclinique
  
  // Base de matériel lourd
  const [machines, setMachines] = useState([
    { id: 1, nom: "BLOCS OPÉRATOIRES COMPLETS (X3 Salles)", prix: 4500000 },
    { id: 2, nom: "IRM 1.5 TESLA & SCANNER MULTIBARRETTES", prix: 7500000 },
    { id: 3, nom: "ÉQUIPEMENT SALLE DE RÉANIMATION (X5 LITS)", prix: 1200000 },
    { id: 4, nom: "MOBILIER D'HOSPITALISATION (X30 LITS MÉDICALISÉS)", prix: 900000 },
    { id: 5, nom: "UNITÉ D'IMAGERIE CONVENTIONNELLE & ÉCHOGRAPHIE", prix: 850000 },
    { id: 6, nom: "LABORATOIRE D'ANALYSES D'URGENCE (POCT)", prix: 450000 },
    { id: 7, nom: "SYSTÈME D'INFORMATION HOSPITALIER (SIH) & SERVEURS", prix: 350000 },
    { id: 8, nom: "CENTRALE D'OXYGÈNE ET FLUIDES MÉDICAUX", prix: 600000 },
    { id: 9, nom: "STÉRILISATION CENTRALE (AUTOCLAVES GRANDE CAPACITÉ)", prix: 550000 }
  ]);

  // Exploitation prévisionnelle à grande échelle
  const [actes, setActes] = useState([
    { id: 1, type: 'Urgences', nom: "Passages aux Urgences", nbrJour: 30, prixUnitaire: 300 },
    { id: 2, type: 'Hospitalisation', nom: "Nuitées d'Hospitalisation Classique", nbrJour: 20, prixUnitaire: 1200 },
    { id: 3, type: 'Chirurgie', nom: "Interventions Chirurgicales (Blocs)", nbrJour: 10, prixUnitaire: 8500 },
    { id: 4, type: 'Imagerie', nom: "Actes d'Imagerie Lourd (IRM/Scanner)", nbrJour: 15, prixUnitaire: 1500 },
    { id: 5, type: 'Maternité', nom: "Accouchements (Voie basse & Césarienne)", nbrJour: 3, prixUnitaire: 4500 },
  ]);

  const [newMachineNom, setNewMachineNom] = useState('');
  const [newMachinePrix, setNewMachinePrix] = useState('');

  if (!isOpen || !area || !specialty) return null;

  // --- LOGIQUE MATÉRIEL ---
  const handleAddMachine = () => {
    if (newMachineNom && newMachinePrix) {
      setMachines([...machines, { id: Date.now(), nom: newMachineNom.toUpperCase(), prix: parseFloat(newMachinePrix) }]);
      setNewMachineNom(''); setNewMachinePrix('');
    }
  };
  const handleRemoveMachine = (id: number) => setMachines(machines.filter(m => m.id !== id));
  const handleUpdateMachinePrice = (id: number, newPrix: number) => {
    setMachines(machines.map(m => m.id === id ? { ...m, prix: newPrix } : m));
  };

  // --- LOGIQUE ACTES ---
  const handleUpdateActe = (id: number, field: 'nbrJour' | 'prixUnitaire', value: number) => {
    setActes(actes.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // --- CALCULS MATHÉMATIQUES ---
  const totalMaterielHT = machines.reduce((acc, curr) => acc + curr.prix, 0);
  const tvaMateriel = totalMaterielHT * 0.20;
  const totalMaterielTTC = totalMaterielHT + tvaMateriel;

  // Construction clinique (estimée à 6000 DH/m² pour du gros oeuvre hospitalier)
  const coutConstructionM2 = 6000;
  const totalAmenagementHT = surface * coutConstructionM2;
  const totalAmenagementTTC = totalAmenagementHT * 1.20;

  const investissementFoncier = surface * area.prixM2;
  
  // Masse salariale hospitalière (Provision 1 mois)
  const masseSalariale = 50000 + (6 * 20000) + (15 * 6000) + (10 * 4000); // 1 Dir + 6 Méd + 15 Infirmiers + 10 Admin = 300 000 DH/mois

  const fraisPreliminaires = 150000; // Études d'impact, architecte, autorisations ministère
  const bfr = 1500000; // Fonds de roulement très lourd (médicaments, consommables blocs)
  
  const totalInvestissement = fraisPreliminaires + investissementFoncier + totalAmenagementTTC + totalMaterielTTC + bfr + masseSalariale;
  const apportPersonnel = totalInvestissement * 0.11;
  const creditSollicite = totalInvestissement * 0.89;

  const totalCAJour = actes.reduce((acc, acte) => acc + (acte.nbrJour * acte.prixUnitaire), 0);
  const totalCAAnnee = totalCAJour * 365; // Une clinique tourne 365 jours / an

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 print:p-0 print:static">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm print:hidden"
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl bg-white text-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[95vh] print:h-auto print:shadow-none print:rounded-none"
      >
        {/* EN-TÊTE */}
        <div className="flex justify-between items-center p-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-wide">Business Plan - Clinique Privée</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors">
              <Printer className="h-4 w-4" /> Sauvegarder en PDF
            </button>
            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-rose-600 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CORPS */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 print:p-0 bg-slate-50">
          
          <div className="text-center mb-10 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-black uppercase mb-2 tracking-tight">Étude de Faisabilité et Business Plan</h1>
            <p className="text-lg font-bold text-blue-700 uppercase">Projet d'Infrastructure : Polyclinique Médico-Chirurgicale • {area.nom}</p>
          </div>

          {/* PARAMÈTRES (Caché au PDF) */}
          <div className="mb-10 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" /> Dimensionnement du Projet Immobilier
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Surface Globale (m²)</label>
                <input 
                  type="number" value={surface} onChange={(e) => setSurface(Number(e.target.value))}
                  className="w-32 px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Indice Foncier ({area.nom})</label>
                <div className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-slate-700 text-lg">{area.prixM2.toLocaleString('fr-FR')} DH/m²</div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium max-w-md italic border-l-2 border-blue-400 pl-3">
                Pour une clinique, les coûts de construction intègrent les normes hospitalières (fluides médicaux, plombage salles radio, ascenseurs monte-malades) estimés à 6 000 DH/m².
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            {/* CONSTRUCTION */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4">I. Foncier & Construction Hospitalière</h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
                <tbody>
                  <tr><td className="border border-slate-300 p-2.5 font-medium">Acquisition du terrain/bâtiment ({surface} m² x {area.prixM2} DH)</td><td className="border border-slate-300 p-2.5 text-right font-black text-blue-700">{formatHT(investissementFoncier)}</td></tr>
                  <tr><td className="border border-slate-300 p-2.5 font-medium">Coût de construction clinique ({surface} m² x {coutConstructionM2} DH HT)</td><td className="border border-slate-300 p-2.5 text-right font-bold">{formatHT(totalAmenagementHT)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border border-slate-900 p-3 text-right font-black uppercase">PT TTC Construction (TVA 20%) :</td><td className="border border-slate-900 p-3 text-right font-black text-lg">{formatHT(totalAmenagementTTC)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* EFFECTIFS */}
            <div>
              <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4">II. Masse Salariale Initiale (Mensuelle)</h3>
              <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100"><th className="border p-3 text-left">Département</th><th className="border p-3 text-center">Effectif</th><th className="border p-3 text-right">Total Mensuel</th></tr>
                </thead>
                <tbody>
                  <tr><td className="border p-3 font-medium">Direction Médicale & Administrative</td><td className="border p-3 text-center">1</td><td className="border p-3 text-right font-bold">50 000</td></tr>
                  <tr><td className="border p-3 font-medium">Médecins Urgentistes & Réanimateurs</td><td className="border p-3 text-center">6</td><td className="border p-3 text-right font-bold">120 000</td></tr>
                  <tr><td className="border p-3 font-medium">Corps Infirmier & Aides-soignants</td><td className="border p-3 text-center">15</td><td className="border p-3 text-right font-bold">90 000</td></tr>
                  <tr><td className="border p-3 font-medium">Administration, Accueil & Sécurité</td><td className="border p-3 text-center">10</td><td className="border p-3 text-right font-bold">40 000</td></tr>
                  <tr className="bg-slate-100"><td colSpan={2} className="border p-3 font-black text-right">PROVISION MENSUELLE :</td><td className="border p-3 text-right font-black text-blue-700">{formatHT(masseSalariale)} DH</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MATÉRIEL LOURD MODIFIABLE */}
          <div className="mb-12 page-break-inside-avoid">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
              III. Équipements Médicaux & Infrastructures Lourdes
              <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider print:hidden">Édition Active</span>
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 p-3 uppercase font-black text-slate-700">Désignation des Équipements</th>
                  <th className="border border-slate-300 p-3 uppercase font-black text-slate-700 w-48 text-right">Montant (DH)</th>
                  <th className="border border-slate-300 p-3 w-12 text-center print:hidden">X</th>
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 p-3 font-medium text-slate-800">{m.nom}</td>
                    <td className="border border-slate-300 p-2">
                      <input 
                        type="number" value={m.prix} onChange={(e) => handleUpdateMachinePrice(m.id, parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-right font-bold text-slate-800 border-b border-transparent focus:border-blue-500 outline-none px-2 py-1 print:border-none appearance-none"
                      />
                    </td>
                    <td className="border border-slate-300 p-2 text-center print:hidden">
                      <button onClick={() => handleRemoveMachine(m.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="h-4 w-4 mx-auto" /></button>
                    </td>
                  </tr>
                ))}
                
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border border-slate-300 p-2"><input type="text" placeholder="Ajouter un équipement (ex: Ambulance médicalisée)..." value={newMachineNom} onChange={(e) => setNewMachineNom(e.target.value)} className="w-full border p-2 text-xs rounded" /></td>
                  <td className="border border-slate-300 p-2"><input type="number" placeholder="Prix HT" value={newMachinePrix} onChange={(e) => setNewMachinePrix(e.target.value)} className="w-full border p-2 text-xs text-right rounded font-bold" /></td>
                  <td className="border border-slate-300 p-2 text-center"><button onClick={handleAddMachine} className="bg-blue-600 text-white p-2 rounded w-full"><Plus className="h-4 w-4 mx-auto" /></button></td>
                </tr>

                <tr className="bg-slate-50">
                  <td className="border border-slate-300 p-3 text-right font-black uppercase text-[11px]">PT HT Équipement :</td>
                  <td className="border border-slate-300 p-3 text-right font-black" colSpan={2}>{formatHT(totalMaterielHT)}</td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td className="border border-slate-900 p-3 text-right font-black uppercase">PT TTC (TVA 20%) :</td>
                  <td className="border border-slate-900 p-3 text-right font-black text-lg" colSpan={2}>{formatHT(totalMaterielTTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* EXPLOITATION PRÉVISIONNELLE CLINIQUE */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">
              IV. Chiffre d'Affaires Prévisionnel Global
              <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider print:hidden">Volumes Modifiables</span>
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100"><th className="border p-3 text-left uppercase">Pôles d'Activités</th><th className="border p-3 text-center uppercase">Volume/Jour</th><th className="border p-3 text-center uppercase">Panier Moyen (DH)</th><th className="border p-3 text-right uppercase">CA Quotidien</th></tr>
              </thead>
              <tbody>
                {actes.map(acte => (
                  <tr key={acte.id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 p-3 font-medium text-slate-700">{acte.nom}</td>
                    <td className="border border-slate-300 p-2">
                      <input type="number" value={acte.nbrJour} onChange={(e) => handleUpdateActe(acte.id, 'nbrJour', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none text-blue-700" />
                    </td>
                    <td className="border border-slate-300 p-2">
                      <input type="number" value={acte.prixUnitaire} onChange={(e) => handleUpdateActe(acte.id, 'prixUnitaire', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none" />
                    </td>
                    <td className="border border-slate-300 p-3 text-right font-bold text-slate-900">{formatHT(acte.nbrJour * acte.prixUnitaire)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50 border-t-2 border-slate-300"><td className="border border-slate-300 p-3 font-black text-right uppercase" colSpan={3}>CA GLOBAL / JOUR :</td><td className="border border-slate-300 p-3 font-black text-right text-lg text-blue-700">{formatHT(totalCAJour)} DH</td></tr>
                <tr className="bg-slate-900 text-white"><td className="border border-slate-900 p-4 font-black text-right uppercase tracking-wide" colSpan={3}>CA ANNUEL (Base 365 Jours / 24h/24) :</td><td className="border border-slate-900 p-4 font-black text-right text-xl">{formatHT(totalCAAnnee)} DH</td></tr>
              </tbody>
            </table>
          </div>

          {/* INVESTISSEMENT ET FINANCEMENT LOURD */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4">V. Bilan d'Investissement & Financement Structuré</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <table className="w-full text-xs border-collapse bg-white shadow-sm">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={2}>Programme d'Investissement (TTC)</th></tr></thead>
                <tbody>
                  <tr><td className="border p-3 uppercase font-medium">Frais Préliminaires (Études, Archi)</td><td className="border p-3 text-right font-black">{formatHT(fraisPreliminaires)}</td></tr>
                  <tr className="bg-blue-50/40"><td className="border p-3 uppercase font-bold text-blue-900">Achat du Foncier ({surface}m²)</td><td className="border p-3 text-right font-black text-blue-700">{formatHT(investissementFoncier)}</td></tr>
                  <tr><td className="border p-3 uppercase font-medium">Construction & Aménagement Hosp.</td><td className="border p-3 text-right font-black">{formatHT(totalAmenagementTTC)}</td></tr>
                  <tr><td className="border p-3 uppercase font-medium">Équipements Médicaux & SIH</td><td className="border p-3 text-right font-black">{formatHT(totalMaterielTTC)}</td></tr>
                  <tr><td className="border p-3 uppercase font-medium">BFR (Consommables, Pharmacie)</td><td className="border p-3 text-right font-black">{formatHT(bfr)}</td></tr>
                  <tr><td className="border p-3 uppercase font-medium">Provision Masse Salariale Initiale</td><td className="border p-3 text-right font-black">{formatHT(masseSalariale)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase tracking-wide">Investissement Total Requis</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse bg-white shadow-sm h-fit">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={3}>Structure de Financement</th></tr></thead>
                <tbody>
                  <tr><td className="border p-4 uppercase font-medium">Fonds Propres (Apport)</td><td className="border p-4 text-center font-black text-slate-600">11 %</td><td className="border p-4 text-right font-black text-emerald-600 text-base">{formatDH(apportPersonnel)}</td></tr>
                  <tr><td className="border p-4 uppercase font-bold text-slate-900">Crédit Bancaire Sollicité</td><td className="border p-4 text-center font-black text-slate-900">89 %</td><td className="border p-4 text-right font-black text-rose-600 text-base">{formatDH(creditSollicite)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase tracking-wide">Total Couverture</td><td className="border p-4 text-center font-black">100 %</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>
            </div>
            
            {/* Box Lead Generation B2B Corporate */}
            <div className="mt-6 p-5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl flex items-start gap-4 print:hidden shadow-sm">
              <Landmark className="h-8 w-8 text-[#0284c7] shrink-0" />
              <div>
                <h4 className="font-black text-[#0c4a6e] text-lg leading-tight mb-1">Dossier de Financement Corporate</h4>
                <p className="text-sm text-[#0369a1]">Votre projet dépasse les standards classiques. Enregistrez ce PDF : nos banques d'affaires partenaires (Financement de projet) vous contacteront pour structurer la dette de <strong className="font-black">{formatDH(creditSollicite)}</strong>.</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
      
      {/* Styles PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .fixed { position: absolute; }
          .print\\:static { position: static !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          .relative.w-full.max-w-6xl, .relative.w-full.max-w-6xl * { visibility: visible; }
          .relative.w-full.max-w-6xl { position: absolute; left: 0; top: 0; width: 100%; overflow: visible !important; height: auto !important; }
        }
      `}} />
    </div>
  );
}