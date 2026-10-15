// Site vitrine (one-pager) servi à / (page d'accueil). Design éditorial : titres serif Fraunces en italique,
// corps Inter, grille asymétrique, mock SVG de la plateforme dans le hero. Chargement des polices
// via Google Fonts dans index.html.
//
// La plateforme métier reste à /. La vitrine est le point d'atterrissage marketing uniquement
// quand on y vient explicitement.

import { useState, useEffect, FormEvent } from 'react';
import {
  Activity, Map, Stethoscope, Landmark, LineChart, Users, FileText, Database, Handshake,
  Check, Sparkles, Mail, ArrowRight, ArrowUpRight, Loader2, CheckCircle2, AlertCircle,
  Menu, X, BarChart3, Target, LayoutGrid,
} from 'lucide-react';

interface Props {
  naviguer: (cible: string) => void;
}

// Polices via Tailwind arbitrary values pour éviter d'étendre tailwind.config.js (déjà géré par
// Vite v4+). Fraunces : titres éditoriaux. Inter : corps.
const fontSerif = "font-['Fraunces']";
const fontBody = "font-['Inter']";

export default function VitrinePage({ naviguer }: Props) {
  const [menuMobile, setMenuMobile] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768 && menuMobile) setMenuMobile(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [menuMobile]);

  const allerVers = (cible: string) => {
    setMenuMobile(false);
    if (cible.startsWith('#')) {
      document.getElementById(cible.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      naviguer(cible);
    }
  };

  return (
    <div className={`min-h-screen bg-[#f8fafc] text-[#0f172a] ${fontBody} selection:bg-[#2563eb] selection:text-[#f8fafc] antialiased`}>

      {/* --- Header vitrine --- */}
      <Header allerVers={allerVers} naviguer={naviguer} menuMobile={menuMobile} setMenuMobile={setMenuMobile} />

      {/* --- Hero éditorial --- */}
      <Hero naviguer={naviguer} allerVers={allerVers} />

      {/* --- Bandeau de preuve (chiffres) --- */}
      <BandeauChiffres />

      {/* --- Mission --- */}
      <Mission />

      {/* --- Dans la plateforme : 4 vraies captures --- */}
      <DansLaPlateforme />

      {/* --- Comment ça marche : 4 étapes --- */}
      <CommentCaMarche />

      {/* --- Packages --- */}
      <Packages naviguer={naviguer} allerVers={allerVers} />

      {/* --- Pour qui --- */}
      <PourQui />

      {/* --- Vidéo de démonstration --- */}
      <VideoDemo />

      {/* --- Contact : bloc dark + formulaire --- */}
      <Contact />

      {/* --- Footer --- */}
      <Footer naviguer={naviguer} allerVers={allerVers} />
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================
function Header({
  allerVers, naviguer, menuMobile, setMenuMobile,
}: { allerVers: (c: string) => void; naviguer: (c: string) => void; menuMobile: boolean; setMenuMobile: (v: boolean) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-[#f8fafc]/85 backdrop-blur-xl border-b border-[#0f172a]/8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-5 flex items-center justify-between gap-6">
        <a href="/" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-[10px] bg-[#2563eb] flex items-center justify-center text-[#f8fafc]">
            <Activity className="h-4.5 w-4.5 stroke-[2.5]" strokeWidth={2.5} />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-[#0f172a]">Empower&nbsp;Doctor</span>
        </a>

        <nav className="hidden md:flex items-center gap-9 text-[13px] font-medium text-[#0f172a]/70">
          <a href="#mission" onClick={e => { e.preventDefault(); allerVers('#mission'); }} className="hover:text-[#0f172a] transition-colors">Mission</a>
          <a href="#comment" onClick={e => { e.preventDefault(); allerVers('#comment'); }} className="hover:text-[#0f172a] transition-colors">Comment ça marche</a>
          <a href="#packages" onClick={e => { e.preventDefault(); allerVers('#packages'); }} className="hover:text-[#0f172a] transition-colors">Packages</a>
          <a href="#contact" onClick={e => { e.preventDefault(); allerVers('#contact'); }} className="hover:text-[#0f172a] transition-colors">Contact</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => naviguer('/plateforme')}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-full bg-[#2563eb] text-[#f8fafc] hover:bg-[#1d4ed8] transition-colors"
          >
            Ouvrir la plateforme <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => setMenuMobile(!menuMobile)}
          className="md:hidden p-2 rounded-lg text-[#0f172a] hover:bg-[#0f172a]/5"
          aria-label={menuMobile ? 'Fermer' : 'Menu'}
        >
          {menuMobile ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {menuMobile && (
        <div className="md:hidden border-t border-[#0f172a]/8">
          <nav className="px-6 py-4 flex flex-col gap-1">
            {[['#mission', 'Mission'], ['#comment', 'Comment ça marche'], ['#packages', 'Packages'], ['#contact', 'Contact']].map(([c, l]) => (
              <a key={c} href={c} onClick={e => { e.preventDefault(); allerVers(c); }} className="px-3 py-2.5 rounded-lg text-sm font-medium text-[#0f172a]/80 hover:bg-[#0f172a]/5">{l}</a>
            ))}
            <button
              onClick={() => { setMenuMobile(false); naviguer('/plateforme'); }}
              className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-full bg-[#2563eb] text-[#f8fafc]"
            >
              Ouvrir la plateforme <ArrowUpRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

// ============================================================================
// HERO ÉDITORIAL
// ============================================================================
function Hero({ naviguer, allerVers }: { naviguer: (c: string) => void; allerVers: (c: string) => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* grain subtil */}
      <div className="absolute inset-0 opacity-[0.025] mix-blend-multiply pointer-events-none" style={{
        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'><filter id=\'n\'><feTurbulence baseFrequency=\'0.9\' numOctaves=\'2\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/></svg>")',
      }} />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

          {/* Colonne texte */}
          <div className="lg:col-span-7">
            <h1 className={`${fontSerif} text-[36px] sm:text-[52px] md:text-[64px] lg:text-[88px] font-medium tracking-[-0.03em] leading-[0.95] text-[#0f172a]`}>
              Pour que le médecin<br />
              reste <em className="italic font-medium text-[#2563eb]">médecin.</em>
            </h1>

            <p className="mt-8 text-[17px] lg:text-[19px] leading-[1.65] text-[#0f172a]/75 max-w-xl">
              Empower Doctor consolide en un seul parcours tout ce que l'ouverture d'un cabinet
              exige aujourd'hui&nbsp;: cartographie, scoring de zone, business plan, financement,
              statut juridique et comptabilité. Vous choisissez, nous orchestrons.
            </p>

            <div className="mt-11 flex flex-wrap items-center gap-4">
              <button
                onClick={() => naviguer('/plateforme')}
                className="group inline-flex items-center gap-3 text-[14px] font-semibold px-6 py-4 rounded-full bg-[#2563eb] text-[#f8fafc] hover:bg-[#1d4ed8] transition-colors"
              >
                Explorer la plateforme
                <span className="w-7 h-7 rounded-full bg-[#f8fafc]/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
              <a
                href="#packages"
                onClick={e => { e.preventDefault(); allerVers('#packages'); }}
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]/80 hover:text-[#0f172a] px-5 py-4 transition-colors underline underline-offset-4 decoration-[#0f172a]/20 hover:decoration-[#0f172a]/60"
              >
                Découvrir les packages
              </a>
            </div>
          </div>

          {/* Colonne visuel : vraie capture de la plateforme (carte Leaflet + pins + légende) */}
          <div className="lg:col-span-5 relative">
            <CadreNavigateur src="/vitrine/carte-pins.webp" alt="Carte interactive des établissements de santé" accent="#2563eb" prioritaire />
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Cadre type "navigateur" pour encadrer les vraies captures d'écran ---
// Barre supérieure avec feux de signalisation + fausse barre d'URL. Donne une impression produit
// sans mentir : les captures qu'on affiche viennent vraiment de la plateforme.
function CadreNavigateur({
  src, alt, url = 'empower-doctor.vercel.app', accent = '#2563eb', className = '', prioritaire = false,
}: {
  src: string; alt: string; url?: string; accent?: string; className?: string;
  /** true pour une image above-the-fold : chargement eager + fetchpriority high (hero LCP). */
  prioritaire?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* ombre portée colorée */}
      <div className="absolute inset-0 translate-x-4 translate-y-5 rounded-[20px]" style={{ backgroundColor: `${accent}22` }} />
      <div className="relative bg-white rounded-[20px] border border-[#0f172a]/10 shadow-[0_30px_60px_-20px_rgba(14,20,32,0.3)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#0f172a]/8 bg-[#f8fafc]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#4f46e5]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
          </div>
          <div className="flex-1 mx-4 px-3 py-1 rounded-md bg-white border border-[#0f172a]/8 text-center">
            <span className="text-[10px] font-mono text-[#0f172a]/50">{url}</span>
          </div>
          <span className="w-8" />
        </div>
        <img
          src={src}
          alt={alt}
          loading={prioritaire ? 'eager' : 'lazy'}
          fetchPriority={prioritaire ? 'high' : 'auto'}
          decoding="async"
          className="block w-full h-auto"
        />
      </div>
    </div>
  );
}

// ============================================================================
// BANDEAU CHIFFRES
// ============================================================================
function BandeauChiffres() {
  const chiffres = [
    { v: '12 500+', l: 'Établissements cartographiés' },
    { v: '6', l: 'Villes marocaines' },
    { v: '20+', l: 'Spécialités médicales scorées' },
    { v: '−5 %', l: 'Remise négociée chez tous nos partenaires' },
  ];
  return (
    <section className="border-y border-[#0f172a]/8 bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#4338ca] text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        {chiffres.map(({ v, l }) => (
          <div key={l}>
            <div className={`${fontSerif} text-3xl md:text-4xl font-medium tracking-tight tabular-nums text-white`}>{v}</div>
            <div className="mt-2 text-[11px] uppercase tracking-widest text-white/75 leading-snug">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// MISSION
// ============================================================================
function Mission() {
  return (
    <section id="mission" className="relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Notre mission</span>
            <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[52px] font-medium leading-[1.02] tracking-tight text-[#0f172a]`}>
              Un seul guichet.<br />
              <em className="italic font-medium">Un seul interlocuteur.</em>
            </h2>
          </div>

          <div className="lg:col-span-7 lg:col-start-6 space-y-10">
            <p className="text-[20px] md:text-[22px] leading-[1.55] text-[#0f172a]/85 font-medium">
              Un professionnel de santé qui ouvre son cabinet passe des mois à démarcher
              séparément banque, comptable, fiscaliste, fournisseur de matériel, bailleur,
              consultant d'étude de marché. <strong className="text-[#2563eb]">Pendant ce temps, il ne soigne pas.</strong>
            </p>

            <div className="pl-6 border-l-2 border-[#2563eb]/40">
              <p className={`${fontSerif} text-[22px] md:text-[28px] italic font-medium leading-[1.3] text-[#0f172a]`}>
                « Le choix de l'emplacement devient une décision argumentée, pas un pari.
                Un business plan personnalisé est construit sur mesure. Le financement est négocié.
                Le juridique est délégué. »
              </p>
              <p className="mt-4 text-[12px] font-semibold uppercase tracking-widest text-[#0f172a]/50">La promesse</p>
            </div>

            <p className="text-[17px] leading-[1.7] text-[#0f172a]/75">
              Nous consolidons toute la chaîne dans un parcours unique. Le médecin ne gère plus
              la logistique de son installation&nbsp;: il consulte, il valide, il consacre son temps
              à ses patients.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// VIDÉO DE DÉMONSTRATION
// ============================================================================
function VideoDemo() {
  return (
    <section id="demo" className="bg-[#f8fafc]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-10 md:mb-12">
          <div className="lg:col-span-7">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Démonstration</span>
            <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-medium leading-[1.02] tracking-tight text-[#0f172a]`}>
              La plateforme <em className="italic font-medium">en mouvement.</em>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-[16px] leading-[1.7] text-[#0f172a]/70">
              Carte, filtres, analytique, scoring, simulateur de crédit — un tour rapide des
              fonctionnalités principales en 45 secondes.
            </p>
          </div>
        </div>

        {/* Conteneur contraint en largeur ET en hauteur : max-w pour éviter que la vidéo tapisse
            tout le viewport desktop, aspect-video (16/9) pour que la hauteur suive la largeur sans
            pousser le fold. object-cover remplit le cadre sans bordes noires. */}
        <div className="relative mx-auto w-full max-w-3xl">
          <div className="absolute inset-0 translate-x-3 translate-y-4 rounded-2xl bg-[#2563eb]/15" />
          <div className="relative bg-[#0f172a] rounded-2xl border border-[#0f172a]/10 shadow-[0_30px_60px_-20px_rgba(14,20,32,0.3)] overflow-hidden aspect-video">
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster="/vitrine/accueil-kpis.webp"
              controls
            >
              <source src="https://res.cloudinary.com/dlqwxsufy/video/upload/v1792004746/Empower_Doctor_demo_nzx1mc.mp4" type="video/mp4" />
              Votre navigateur ne lit pas les vidéos MP4.
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// DANS LA PLATEFORME (galerie des vraies captures)
// ============================================================================
function DansLaPlateforme() {
  const vues = [
    {
      src: '/vitrine/accueil-kpis.webp',
      alt: 'Vue d\'ensemble : établissements par ville et par spécialité',
      Icone: LayoutGrid,
      titre: 'Vue d\'ensemble',
      desc: '12 597 établissements répartis sur 6 villes et 20+ spécialités, filtrables en un clic.',
    },
    {
      src: '/vitrine/scoring-classement.webp',
      alt: 'Classement des zones par score géospatial',
      Icone: Target,
      titre: 'Classement des zones',
      desc: 'Chaque zone reçoit un score sur 100 — démographie, pouvoir d\'achat, saturation concurrentielle — pour trier les meilleures implantations pour votre spécialité.',
    },
    {
      src: '/vitrine/analytics.webp',
      alt: 'Analytique géospatiale par arrondissement',
      Icone: BarChart3,
      titre: 'Analytique géospatiale',
      desc: 'Table croisée population, densité, pyramide des âges, prix immobilier et saturation par arrondissement.',
    },
    {
      src: '/vitrine/simulateur.webp',
      alt: 'Simulateur de crédit professionnel',
      Icone: Landmark,
      titre: 'Simulateur de crédit',
      desc: 'Mensualité, coût total et tableau d\'amortissement mois par mois pour un crédit professionnel.',
    },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="mb-16 md:mb-20 max-w-3xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Dans la plateforme</span>
          <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-medium leading-[1.02] tracking-tight text-[#0f172a]`}>
            Vu de l'intérieur,<br />
            <em className="italic font-medium">données réelles.</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {vues.map(({ src, alt, Icone, titre, desc }, i) => (
            <div key={titre} className={`group ${i % 2 === 1 ? 'md:mt-16' : ''}`}>
              <CadreNavigateur src={src} alt={alt} accent={i % 2 === 0 ? '#2563eb' : '#0f172a'} />
              <div className="mt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#2563eb] text-[#f8fafc] flex items-center justify-center shrink-0">
                  <Icone className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h3 className={`${fontSerif} text-[22px] font-medium tracking-tight text-[#0f172a]`}>{titre}</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.65] text-[#0f172a]/70 max-w-md">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Business plan : 2 vraies vues (graphique + CPC détaillé) côte à côte */}
        <div className="mt-24 md:mt-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-10">
            <div className="lg:col-span-7">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Business plan</span>
              <h3 className={`${fontSerif} mt-3 text-[24px] sm:text-[28px] md:text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-tight text-[#0f172a]`}>
                Une étude de faisabilité sur <em className="italic font-medium">5 ans, livrée en PDF.</em>
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[15px] leading-[1.7] text-[#0f172a]/70">
                Compte de résultat prévisionnel, cash-flow cumulé, remboursement du crédit, graphique
                d'évolution — un document complet, chiffré sur votre zone et votre spécialité, prêt
                à être présenté à votre banque.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <CadreNavigateur src="/vitrine/bp-graphique.webp" alt="Graphique d'évolution charges / chiffre d'affaires / résultat net" accent="#2563eb" />
            <CadreNavigateur src="/vitrine/bp-cpc.webp" alt="Compte de résultat prévisionnel sur 5 ans" accent="#4f46e5" />
          </div>
        </div>

        {/* Dashboard admin : pleine largeur, bandeau "coulisses" */}
        <div className="mt-24 md:mt-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-10">
            <div className="lg:col-span-7">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">En coulisses</span>
              <h3 className={`${fontSerif} mt-3 text-[24px] sm:text-[28px] md:text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-tight text-[#0f172a]`}>
                Un dashboard interne pour piloter <em className="italic font-medium">la qualité des données.</em>
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[15px] leading-[1.7] text-[#0f172a]/70">
                Chaque établissement est traçable, chaque signalement est traité, chaque métrique
                est mesurée — c'est ce qui fait tenir la promesse "données réelles".
              </p>
            </div>
          </div>
          <CadreNavigateur src="/vitrine/admin-dashboard.webp" alt="Dashboard d'administration interne" accent="#4f46e5" />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// COMMENT ÇA MARCHE
// ============================================================================
function CommentCaMarche() {
  const etapes = [
    { n: '01', Icone: Map, titre: 'Choisir la zone', desc: 'Cartographie de 12 500+ établissements et scoring par spécialité : densité, concurrence, pyramide des âges, prix du m².' },
    { n: '02', Icone: LineChart, titre: 'Construire le business plan', desc: 'Un business plan personnalisé sur mesure, bâti à partir des données de la zone et de la spécialité choisies.' },
    { n: '03', Icone: Landmark, titre: 'Financer le projet', desc: 'Simulateurs de crédit professionnel et partenariats directs avec les banques pour un financement négocié à des conditions avantageuses.' },
    { n: '04', Icone: Handshake, titre: "S'installer", desc: 'Mise en relation avec les partenaires du réseau — banques, comptable, fiscaliste, aménagement, fournisseurs — avec une remise négociée de 5 % sur l\'ensemble des frais.' },
  ];
  return (
    <section id="comment" className="bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#4338ca] text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="max-w-3xl mb-16 md:mb-20">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Comment ça marche</span>
          <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-medium leading-[1.02] tracking-tight text-white`}>
            De l'intuition<br />à l'installation,<br />
            <em className="italic font-medium text-amber-300">en quatre étapes.</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {etapes.map(({ n, Icone, titre, desc }, i) => (
            <div key={n} className="relative pt-8 border-t border-white/25">
              {/* ligne de connexion sauf dernière étape */}
              {i < etapes.length - 1 && (
                <div className="hidden lg:block absolute -top-px left-full w-full h-px bg-white/25 pointer-events-none" aria-hidden />
              )}
              <div className="flex items-center justify-between">
                <span className={`${fontSerif} text-5xl font-medium text-white/50 tabular-nums tracking-tight`}>{n}</span>
                <Icone className="w-6 h-6 text-amber-300" strokeWidth={1.5} />
              </div>
              <h3 className={`${fontSerif} mt-6 text-[22px] font-medium tracking-tight text-white`}>{titre}</h3>
              <p className="mt-3 text-[14px] leading-[1.65] text-white/80">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PACKAGES
// ============================================================================
function Packages({ naviguer, allerVers }: { naviguer: (c: string) => void; allerVers: (c: string) => void }) {
  return (
    <section id="packages" className="relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-14 md:mb-16">
          <div className="lg:col-span-7">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Packages</span>
            <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-medium leading-[1.02] tracking-tight text-[#0f172a]`}>
              Trois formules.<br />
              <em className="italic font-medium">Un seul objectif.</em>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-[16px] leading-[1.7] text-[#0f172a]/70">
              De la découverte libre de la carte à l'accompagnement personnalisé par nos experts.
              Vous choisissez le niveau qui correspond à votre projet. Évolution contractuelle :
              +10 % année 2, +20 % année 5.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <CardPackage
            nom="Package 1 — Gratuit"
            prix="0"
            unite="DH"
            prixDetail="Sans engagement"
            baseline="Explorer librement la cartographie et comprendre son marché."
            features={[
              'Carte et annuaire complets, toutes villes',
              'Filtres ville, spécialité, source',
              'Vue démographique basique par zone',
              'Signalement de correction',
            ]}
            ctaLabel="Essayer gratuitement"
            onCta={() => naviguer('/plateforme')}
          />
          <CardPackage
            nom="Package 2 — Accompagnement"
            prix="2 000"
            unite="DH / mois"
            prixDetail="Formule populaire"
            baseline="Comptable, fiscaliste, juridique, aménagement : votre installation pilotée."
            features={[
              'Accompagnement par un comptable et un conseiller fiscaliste',
              'Mise en place et choix du statut juridique du cabinet',
              'Négociation de devis pour l\'aménagement du local',
              'Tenue de comptabilité',
            ]}
            ctaLabel="Nous contacter"
            onCta={() => allerVers('#contact')}
            featured
          />
          <CardPackage
            nom="Package 3 — Accompagnement Plus"
            prix="3 500"
            unite="DH / mois"
            prixDetail="Clé en main"
            baseline="L'accompagnement Package 2 enrichi par l'expertise terrain et le réseau."
            featureHeader="Tout le Package 2, plus :"
            features={[
              'Enquête de terrain, étude de marché fine à l\'échelle du quartier',
              'Un entretien annuel avec les experts du réseau',
              'Mise en relation entre médecins pour l\'ouverture collaborative de cabinets mono- ou multi-spécialités',
            ]}
            ctaLabel="Nous contacter"
            onCta={() => allerVers('#contact')}
          />
        </div>
      </div>
    </section>
  );
}

function CardPackage({
  nom, prix, unite, prixDetail, baseline, features, featureHeader, ctaLabel, onCta, featured,
}: {
  nom: string; prix: string; unite: string; prixDetail: string; baseline: string;
  features: string[]; featureHeader?: string; ctaLabel: string; onCta: () => void; featured?: boolean;
}) {
  return (
    <div className={`relative rounded-[28px] p-8 lg:p-10 flex flex-col transition-transform hover:-translate-y-1 duration-300 ${
      featured
        ? 'bg-gradient-to-br from-[#2563eb] to-[#4338ca] text-white shadow-[0_30px_60px_-20px_rgba(37,99,235,0.5)]'
        : 'bg-white border border-[#0f172a]/8 shadow-[0_10px_40px_-20px_rgba(14,20,32,0.15)]'
    }`}>
      {featured && (
        <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-[#2563eb] text-[#f8fafc]">
          <Sparkles className="w-3 h-3" /> Recommandé
        </span>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`${fontSerif} text-[26px] font-medium tracking-tight`}>{nom}</h3>
          <p className={`text-[12px] uppercase tracking-widest mt-1 font-semibold ${featured ? 'text-[#f8fafc]/70' : 'text-[#0f172a]/50'}`}>{prixDetail}</p>
        </div>
      </div>

      <div className="mt-7 flex items-baseline gap-2">
        <span className={`${fontSerif} text-[52px] md:text-[64px] font-medium leading-none tracking-tighter tabular-nums`}>{prix}</span>
        <span className={`text-[13px] font-medium ${featured ? 'text-[#f8fafc]/70' : 'text-[#0f172a]/55'}`}>{unite}</span>
      </div>

      <p className={`mt-4 text-[14px] leading-[1.6] ${featured ? 'text-[#f8fafc]/85' : 'text-[#0f172a]/70'}`}>{baseline}</p>

      {featureHeader && (
        <p className={`mt-8 text-[11px] font-semibold uppercase tracking-widest ${featured ? 'text-[#f8fafc]/70' : 'text-[#0f172a]/50'}`}>{featureHeader}</p>
      )}

      <ul className="mt-5 space-y-3 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-3 text-[14px]">
            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${featured ? 'text-[#f8fafc]' : 'text-[#2563eb]'}`} strokeWidth={2.5} />
            <span className={featured ? 'text-[#f8fafc]/90' : 'text-[#0f172a]/80'}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onCta}
        className={`mt-10 group inline-flex items-center justify-between gap-3 text-[13px] font-semibold px-5 py-3.5 rounded-full transition-colors ${
          featured
            ? 'bg-[#2563eb] text-[#f8fafc] hover:bg-[#1d4ed8]'
            : 'bg-[#2563eb] text-[#f8fafc] hover:bg-[#1d4ed8]'
        }`}
      >
        <span>{ctaLabel}</span>
        <span className="w-6 h-6 rounded-full bg-[#f8fafc]/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
          <ArrowRight className="w-3 h-3" />
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// POUR QUI
// ============================================================================
function PourQui() {
  const cibles = [
    { Icone: Stethoscope, label: 'Médecins généralistes & spécialistes' },
    { Icone: Users, label: 'Cabinets collaboratifs' },
    { Icone: Activity, label: 'Cliniques & laboratoires' },
    { Icone: Sparkles, label: 'Nouveaux diplômés' },
    { Icone: FileText, label: 'Dentistes & kinésithérapeutes' },
    { Icone: Database, label: 'Groupes qui ouvrent une antenne' },
  ];
  return (
    <section className="bg-[#f8fafc]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">Pour qui</span>
            <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[52px] font-medium leading-[1.02] tracking-tight text-[#0f172a]`}>
              Pensé pour les professionnels de santé qui <em className="italic font-medium">s'installent.</em>
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-[#0f172a]/70">
              Que vous soyez nouveau diplômé, médecin installé qui change de cabinet, ou groupe qui
              ouvre une nouvelle clinique : notre plateforme s'adresse à toute profession de santé
              libérale.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#0f172a]/10 border border-[#0f172a]/10 rounded-2xl overflow-hidden">
              {cibles.map(({ Icone, label }) => (
                <div key={label} className="bg-white p-6 lg:p-8 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#f8fafc] border border-[#0f172a]/10 flex items-center justify-center shrink-0">
                    <Icone className="w-5 h-5 text-[#2563eb]" strokeWidth={1.75} />
                  </div>
                  <p className="text-[14px] font-medium text-[#0f172a]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CONTACT
// ============================================================================
function Contact() {
  return (
    <section id="contact" className="bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#4338ca] text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

          <div className="lg:col-span-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Nous contacter</span>
            <h2 className={`${fontSerif} mt-4 text-[28px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-medium leading-[1.02] tracking-tight text-white`}>
              Parlons de votre projet <em className="italic font-medium text-amber-300">d'installation.</em>
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-white/85">
              Que vous soyez à la phase de réflexion ou prêt à signer un bail, nous vous aidons à
              structurer la décision avec des données réelles. Écrivez-nous — nous revenons vers
              vous sous 48h ouvrées.
            </p>

            <div className="mt-10 space-y-5">
              <a href="mailto:abderrahmane.elbaghdadi@cfconsulting.ma" className="flex items-start gap-4 text-[14px] text-white/90 hover:text-white transition-colors group">
                <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-1">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-white/65">E-mail</div>
                  <div className="font-medium mt-1 break-all">abderrahmane.elbaghdadi@cfconsulting.ma</div>
                </div>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <FormulaireContact />
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Formulaire ---
function FormulaireContact() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null); setSucces(false);
    if (nom.trim().length < 2) { setErreur('Nom trop court.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErreur('E-mail invalide.'); return; }
    if (message.trim().length < 10) { setErreur('Message trop court (10 caractères minimum).'); return; }

    setEnCours(true);
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim(), email: email.trim(), sujet: sujet.trim(), message: message.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur serveur');
      }
      setSucces(true);
      setNom(''); setEmail(''); setSujet(''); setMessage('');
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const inputCls = "w-full px-4 py-3.5 text-[14px] bg-white/10 border border-white/25 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-amber-300 focus:bg-white/15 transition-colors";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-white/75 mb-2";

  return (
    <form onSubmit={onSubmit} className="bg-white/5 border border-white/15 rounded-[28px] p-6 md:p-10 backdrop-blur-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Nom</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)} required maxLength={120} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} className={inputCls} />
        </div>
      </div>
      <div className="mt-5">
        <label className={labelCls}>Sujet <span className="normal-case font-normal text-white/55">— facultatif</span></label>
        <input type="text" value={sujet} onChange={e => setSujet(e.target.value)} maxLength={200} placeholder="Par exemple : question sur le package Accompagnement" className={inputCls} />
      </div>
      <div className="mt-5">
        <label className={labelCls}>Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={6} maxLength={3000} placeholder="Décrivez votre projet, votre spécialité, la zone qui vous intéresse…" className={`${inputCls} resize-y`} />
        <div className="mt-2 text-right text-[10px] text-white/55 font-mono">{message.length}/3000</div>
      </div>

      {erreur && (
        <div className="mt-5 flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <p className="text-[13px] text-rose-200">{erreur}</p>
        </div>
      )}
      {succes && (
        <div className="mt-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <p className="text-[13px] text-emerald-100">Message envoyé. Nous revenons vers vous sous 48h ouvrées.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="mt-7 group w-full inline-flex items-center justify-center gap-3 text-[14px] font-semibold px-6 py-4 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        Envoyer le message
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
          <ArrowRight className="w-3 h-3" />
        </span>
      </button>
    </form>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer({ naviguer, allerVers }: { naviguer: (c: string) => void; allerVers: (c: string) => void }) {
  return (
    <footer className="bg-[#f8fafc] border-t border-[#0f172a]/8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <a href="/" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[10px] bg-[#2563eb] flex items-center justify-center text-[#f8fafc]">
                <Activity className="h-4.5 w-4.5 stroke-[2.5]" strokeWidth={2.5} />
              </div>
              <span className={`${fontSerif} text-xl font-medium tracking-tight text-[#0f172a]`}>Empower Doctor</span>
            </a>
            <p className="mt-5 text-[14px] leading-[1.7] text-[#0f172a]/65 max-w-sm">
              Le guichet unique qui permet aux professionnels de santé de consacrer leur temps
              exclusivement à leurs patients.
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#0f172a]/50 mb-4">Plateforme</h4>
              <ul className="space-y-3 text-[14px]">
                <li><button onClick={() => naviguer('/plateforme')} className="text-[#0f172a]/80 hover:text-[#0f172a]">Annuaire & carte</button></li>
                <li><button onClick={() => naviguer('/simulateur-credit')} className="text-[#0f172a]/80 hover:text-[#0f172a]">Simulateur de crédit</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#0f172a]/50 mb-4">Vitrine</h4>
              <ul className="space-y-3 text-[14px]">
                <li><a href="#mission" onClick={e => { e.preventDefault(); allerVers('#mission'); }} className="text-[#0f172a]/80 hover:text-[#0f172a]">Mission</a></li>
                <li><a href="#packages" onClick={e => { e.preventDefault(); allerVers('#packages'); }} className="text-[#0f172a]/80 hover:text-[#0f172a]">Packages</a></li>
                <li><a href="#contact" onClick={e => { e.preventDefault(); allerVers('#contact'); }} className="text-[#0f172a]/80 hover:text-[#0f172a]">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#0f172a]/50 mb-4">Contact</h4>
              <ul className="space-y-3 text-[14px]">
                <li><a href="mailto:abderrahmane.elbaghdadi@cfconsulting.ma" className="text-[#0f172a]/80 hover:text-[#0f172a] break-all">E-mail</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-[#0f172a]/8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12px] text-[#0f172a]/50">
          <p>© {new Date().getFullYear()} Empower Doctor — Choisir la meilleure implantation pour son cabinet médical.</p>
          <p className="font-mono text-[11px]">Casablanca, Maroc · fr-MA</p>
        </div>
      </div>
    </footer>
  );
}
