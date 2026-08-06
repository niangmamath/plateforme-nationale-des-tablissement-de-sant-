import React, { useState, useEffect } from 'react';
import { X, FileText, Calculator, Landmark, Download, Plus, Trash2, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface BusinessPlanGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  area: any | null;
  config: any | null; // Reçoit la configuration (ex: DERMATO_CONFIG)
}

const formatDH = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
const formatHT = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
  const [newMachineNom, setNewMachineNom] = useState('');
  const [newMachinePrix, setNewMachinePrix] = useState('');

  const [actes, setActes] = useState<any[]>([]);

  // Synchronisation de la configuration entrante avec les états éditables
  useEffect(() => {
    if (config) {
      setAmenagements([...config.amenagements]);
      setEffectifs([...config.effectifs]);
      setMachines([...config.machines]);
      setActes([...config.actes]);
    }
  }, [config]);

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
      setMachines([...machines, { id: Date.now(), nom: newMachineNom.toUpperCase(), prix: parseFloat(newMachinePrix) }]);
      setNewMachineNom(''); setNewMachinePrix('');
    }
  };

  const handleUpdateActe = (id: number, field: 'nom' | 'nbrJour' | 'prixUnitaire', value: string | number) => setActes(actes.map(a => a.id === id ? { ...a, [field]: value } : a));

  // --- CALCULS MATHÉMATIQUES GLOBAUX ---
  const baseAmenagementHT = amenagements.reduce((acc, curr) => acc + curr.prix, 0);
  const surcoutSurfaceHT = (surface - 80) * 1500; 
  const totalAmenagementHT = baseAmenagementHT + surcoutSurfaceHT;
  const totalAmenagementTTC = totalAmenagementHT * 1.20;

  const masseSalariale = effectifs.reduce((acc, curr) => acc + (curr.qte * curr.salaire), 0);

  const totalMaterielHT = machines.reduce((acc, curr) => acc + curr.prix, 0);
  const tvaMateriel = totalMaterielHT * 0.20;
  const totalMaterielTTC = totalMaterielHT + tvaMateriel;

  // Utilisation dynamique des prix de l'area (au lieu du dictionnaire figé)
  const loyerM2 = area.loyerM2 || 65; 
  const loyerMensuel = surface * loyerM2;
  const investissementFoncier = typeOccupation === 'achat' ? surface * (area.prixM2 || 10000) : loyerMensuel * 4;

  const fraisPreliminaires = config.fraisPreliminaires || 5000;
  const bfr = 25000;
  const surfaceInitiale = config.surfaceDefaut || 80;

  // Initialisation de la surface une seule fois au chargement
  useEffect(() => {
    if (config) setSurface(config.surfaceDefaut || 80);
  }, [config]);
  
  const totalInvestissement = fraisPreliminaires + investissementFoncier + totalAmenagementTTC + totalMaterielTTC + bfr + masseSalariale;
  const apportPersonnel = totalInvestissement * 0.11;
  const creditSollicite = totalInvestissement * 0.89;

  const totalCAJour = actes.reduce((acc, acte) => acc + (acte.nbrJour * acte.prixUnitaire), 0);
  const totalCAAnnee = totalCAJour * 300;

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
                <label className="text-xs font-bold text-slate-500 uppercase">Indice Foncier</label>
                <div className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-slate-700 text-lg">{typeOccupation === 'achat' ? `${(area.prixM2 || 10000).toLocaleString('fr-FR')} DH/m²` : `${loyerM2} DH/m²/mois`}</div>
              </div>
            </div>
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
                  {surface !== 80 && (
                    <tr className="bg-blue-50/50"><td className="border border-slate-300 p-2 text-blue-700 font-medium">Ajustement surface ({surface} m²)</td><td className="border border-slate-300 p-2 text-right font-bold text-blue-700">{formatHT(surcoutSurfaceHT)}</td><td className="border border-slate-300 print:hidden"></td></tr>
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
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">III. Équipement & Spécialités<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead><tr className="bg-slate-100"><th className="border p-3 text-left">Équipement</th><th className="border p-3 text-right w-40">Montant (DH)</th><th className="border p-3 w-12 print:hidden">X</th></tr></thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="border p-2"><input type="text" value={m.nom} onChange={(e) => handleUpdateMachine(m.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium text-slate-800 outline-none print:border-none" /></td>
                    <td className="border p-2"><input type="number" value={m.prix} onChange={(e) => handleUpdateMachine(m.id, 'prix', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-bold outline-none print:border-none appearance-none" /></td>
                    <td className="border p-2 text-center print:hidden"><button onClick={() => handleRemoveMachine(m.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                  </tr>
                ))}
                <tr className="print:hidden bg-blue-50/30">
                  <td className="border p-2"><input type="text" placeholder="Ajouter une machine..." value={newMachineNom} onChange={(e) => setNewMachineNom(e.target.value)} className="w-full border p-2 text-xs rounded" /></td>
                  <td className="border p-2"><input type="number" placeholder="Prix HT" value={newMachinePrix} onChange={(e) => setNewMachinePrix(e.target.value)} className="w-full border p-2 text-xs text-right rounded" /></td>
                  <td className="border p-2 text-center"><button onClick={handleAddMachine} className="bg-blue-600 text-white p-2 rounded w-full"><Plus className="h-4 w-4 mx-auto" /></button></td>
                </tr>
                <tr className="bg-slate-900 text-white"><td className="border p-3 text-right font-black">PT TTC (TVA 20%) :</td><td className="border p-3 text-right font-black text-lg" colSpan={2}>{formatHT(totalMaterielTTC)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* EXPLOITATION PRÉVISIONNELLE */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4 flex justify-between items-end">IV. Chiffre d'Affaires Prévisionnel<span className="text-[10px] font-normal text-slate-500 uppercase print:hidden">Édition activée</span></h3>
            <table className="w-full text-xs border-collapse border border-slate-300 bg-white">
              <thead><tr className="bg-slate-100"><th className="border p-3 text-left">Nature des actes</th><th className="border p-3 text-center">Actes/Jour</th><th className="border p-3 text-center">Tarif Moyen (DH)</th><th className="border p-3 text-right">CA Quotidien</th></tr></thead>
              <tbody>
                {actes.map(acte => (
                  <tr key={acte.id} className="hover:bg-slate-50">
                    <td className="border p-2"><input type="text" value={acte.nom} onChange={(e) => handleUpdateActe(acte.id, 'nom', e.target.value)} className="w-full bg-transparent font-medium text-slate-700 outline-none print:border-none" /></td>
                    <td className="border p-2"><input type="number" value={acte.nbrJour} onChange={(e) => handleUpdateActe(acte.id, 'nbrJour', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none text-blue-700" /></td>
                    <td className="border p-2"><input type="number" value={acte.prixUnitaire} onChange={(e) => handleUpdateActe(acte.id, 'prixUnitaire', parseFloat(e.target.value) || 0)} className="w-full text-center font-bold outline-none border-b border-dashed focus:border-blue-500 print:border-none" /></td>
                    <td className="border p-3 text-right font-bold text-slate-900">{formatHT(acte.nbrJour * acte.prixUnitaire)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50"><td className="border p-3 font-black text-right" colSpan={3}>TOTAL CA / JOUR :</td><td className="border p-3 font-black text-right text-lg text-blue-700">{formatHT(totalCAJour)} DH</td></tr>
                <tr className="bg-slate-900 text-white"><td className="border p-4 font-black text-right" colSpan={3}>CA ANNUEL (Base 300 jours) :</td><td className="border p-4 font-black text-right text-xl">{formatHT(totalCAAnnee)} DH</td></tr>
              </tbody>
            </table>
          </div>

          {/* INVESTISSEMENT ET FINANCEMENT */}
          <div className="page-break-inside-avoid mb-10">
            <h3 className="text-xl font-black text-slate-900 border-l-4 border-blue-600 pl-3 mb-4">V. Programme d'Investissement & Financement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <table className="w-full text-xs border-collapse bg-white shadow-sm">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={2}>Investissement (TTC)</th></tr></thead>
                <tbody>
                  <tr><td className="border p-3 font-medium">Frais Préliminaires</td><td className="border p-3 text-right font-black">{formatHT(fraisPreliminaires)}</td></tr>
                  <tr className="bg-blue-50/40">
                    <td className="border p-3 font-bold text-blue-900">{typeOccupation === 'achat' ? `Achat du Local (${surface}m²)` : `Frais d'installation (${surface}m² - Caution+Agence)`}</td>
                    <td className="border p-3 text-right font-black text-blue-700">{formatHT(investissementFoncier)}</td>
                  </tr>
                  <tr><td className="border p-3 font-medium">Aménagements et Installations</td><td className="border p-3 text-right font-black">{formatHT(totalAmenagementTTC)}</td></tr>
                  <tr><td className="border p-3 font-medium">Matériels & Équipements Lasers</td><td className="border p-3 text-right font-black">{formatHT(totalMaterielTTC)}</td></tr>
                  <tr><td className="border p-3 font-medium">Fonds de Roulement (Produits HN)</td><td className="border p-3 text-right font-black">{formatHT(bfr)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase">Total Investissement</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse bg-white shadow-sm h-fit">
                <thead><tr><th className="border bg-slate-50 p-3 text-left font-black" colSpan={3}>Plan de Financement</th></tr></thead>
                <tbody>
                  <tr><td className="border p-4 font-medium">Apport Personnel</td><td className="border p-4 text-center font-black">11 %</td><td className="border p-4 text-right font-black text-emerald-600 text-sm">{formatDH(apportPersonnel)}</td></tr>
                  <tr><td className="border p-4 font-medium">Crédit Sollicité</td><td className="border p-4 text-center font-black">89 %</td><td className="border p-4 text-right font-black text-rose-600 text-sm">{formatDH(creditSollicite)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="border p-4 font-black uppercase">Total Financement</td><td className="border p-4 text-center font-black">100 %</td><td className="border p-4 text-right font-black text-lg">{formatHT(totalInvestissement)}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-5 bg-[#fffdf0] border border-[#f5e3a8] rounded-xl flex items-start gap-4 print:hidden shadow-sm">
              <Landmark className="h-8 w-8 text-[#d4af37] shrink-0" />
              <div>
                <h4 className="font-black text-[#856614] text-lg leading-tight mb-1">Demande de Financement</h4>
                <p className="text-sm text-[#a3801f]">Enregistrez ce PDF pour le transmettre à la banque concernant le crédit de <strong className="font-black">{formatDH(creditSollicite)}</strong> pour votre projet.</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } .fixed { position: absolute; } .print\\:static { position: static !important; } .print\\:hidden { display: none !important; } .print\\:p-0 { padding: 0 !important; } .print\\:shadow-none { box-shadow: none !important; } .print\\:border-none { border: none !important; } .page-break-inside-avoid { page-break-inside: avoid; } .relative.w-full.max-w-6xl, .relative.w-full.max-w-6xl * { visibility: visible; } .relative.w-full.max-w-6xl { position: absolute; left: 0; top: 0; width: 100%; overflow: visible !important; height: auto !important; } }`}} />
    </div>
  );
}