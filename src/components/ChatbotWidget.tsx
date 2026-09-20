/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: number;
  type: 'bot' | 'user';
  text: string;
  erreur?: boolean;
}

const MESSAGE_ACCUEIL: Message = {
  id: 1,
  type: 'bot',
  text: "Bonjour, je suis Empower, l'assistant IA de la plateforme. Je vous aide à comparer les zones des villes couvertes : concurrence par spécialité, démographie, prix et loyers au m². Que souhaitez-vous savoir ?",
};

// Questions auxquelles l'assistant sait réellement répondre avec les données du site (concurrence
// par arrondissement, démographie, loyers) — pas de question sur ce qu'il ne connaît pas.
const SUGGESTIONS = [
  "Où ouvrir un cabinet de pédiatrie à Casablanca ?",
  "Quels arrondissements de Rabat manquent de dentistes ?",
  "Combien de laboratoires d'analyses à Marrakech ?",
  "Quelle zone de Tanger a les loyers les plus bas ?",
];

const MESSAGE_RESEAU = "Impossible de joindre l'assistant. Vérifiez votre connexion puis réessayez.";

function AvatarEmpower({ taille }: { taille: 'sm' | 'md' }) {
  const dimension = taille === 'md' ? 'p-2 rounded-lg' : 'h-7 w-7 rounded-full flex items-center justify-center';
  return (
    <div className={`${dimension} bg-gradient-to-br from-blue-600 to-indigo-600 shrink-0`}>
      <Sparkles className={taille === 'md' ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5 text-white'} />
    </div>
  );
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([MESSAGE_ACCUEIL]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // `base` : l'historique sur lequel s'appuie l'envoi — le plus souvent l'état courant, mais
  // "Réessayer" repart de l'historique privé de la question échouée et de sa bulle d'erreur.
  const envoyer = async (texte: string, base: Message[] = messages) => {
    const question = texte.trim();
    if (!question || isTyping) return;

    const historique: Message[] = [...base, { id: Date.now(), type: 'user', text: question }];
    setMessages(historique);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historique.filter((m) => !m.erreur).map((m) => ({ role: m.type === 'user' ? 'user' : 'model', text: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Une erreur est survenue, réessayez dans un instant.');
      setMessages((prev) => [...prev, { id: Date.now(), type: 'bot', text: data.text || "Je n'ai pas de réponse à vous proposer pour l'instant." }]);
    } catch (err: any) {
      // Un fetch qui échoue avant toute réponse lève une TypeError (hors ligne, serveur injoignable).
      const message = err instanceof TypeError ? MESSAGE_RESEAU : err?.message || MESSAGE_RESEAU;
      setMessages((prev) => [...prev, { id: Date.now(), type: 'bot', text: message, erreur: true }]);
    } finally {
      setIsTyping(false);
    }
  };

  const reessayer = () => {
    const indexDerniereQuestion = messages.map((m) => m.type).lastIndexOf('user');
    if (indexDerniereQuestion === -1) return;
    envoyer(messages[indexDerniereQuestion].text, messages.slice(0, indexDerniereQuestion));
  };

  const nouvelleConversation = () => {
    if (isTyping) return;
    setMessages([MESSAGE_ACCUEIL]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const conversationVierge = messages.length === 1;
  const derniereEstErreur = messages[messages.length - 1]?.erreur === true;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans" onKeyDown={(e) => e.key === 'Escape' && isOpen && setIsOpen(false)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Assistant Empower"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] max-w-[400px] h-[540px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* En-tête */}
            <div className="bg-slate-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <AvatarEmpower taille="md" />
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" aria-hidden="true"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white text-sm font-black tracking-wide">Empower</h3>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 text-[9px] font-black uppercase tracking-wider">Assistant IA</span>
                  </div>
                  <p className="text-slate-400 text-[10px] font-semibold">Implantation santé · données de la plateforme</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!conversationVierge && (
                  <button onClick={nouvelleConversation} disabled={isTyping} aria-label="Nouvelle conversation" title="Nouvelle conversation" className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 transition-colors rounded-lg">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} aria-label="Fermer l'assistant" className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4" aria-live="polite">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[88%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.type === 'user' ? (
                      <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-1 bg-blue-100 text-blue-600"><User className="h-4 w-4" /></div>
                    ) : msg.erreur ? (
                      <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-1 bg-rose-100 text-rose-600"><AlertCircle className="h-4 w-4" /></div>
                    ) : (
                      <div className="mt-1"><AvatarEmpower taille="sm" /></div>
                    )}
                    <div className={`p-3 text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                      msg.type === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                        : msg.erreur
                          ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl rounded-tl-sm font-medium'
                          : 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm font-medium'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}

              {derniereEstErreur && !isTyping && (
                <div className="flex justify-start pl-9">
                  <button onClick={reessayer} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-500 rounded-full text-[12px] font-bold text-slate-700 transition-colors">
                    <RotateCcw className="h-3.5 w-3.5" /> Réessayer
                  </button>
                </div>
              )}

              {conversationVierge && !isTyping && (
                <div className="pl-9 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Essayez par exemple</p>
                  <div className="flex flex-col items-start gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => envoyer(s)} className="text-left px-3 py-2 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-700 rounded-xl text-[12px] font-semibold text-slate-600 transition-colors shadow-sm">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="mt-1"><AvatarEmpower taille="sm" /></div>
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex gap-1 items-center h-[42px]" aria-label="Empower est en train de répondre">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Saisie */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner focus-within:border-slate-400">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  maxLength={500}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && envoyer(inputValue)}
                  placeholder="Posez une question sur une ville ou une spécialité…"
                  aria-label="Votre question"
                  className="flex-1 bg-transparent text-sm px-3 py-2 outline-none text-slate-700 placeholder:text-slate-400"
                />
                <button
                  onClick={() => envoyer(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  aria-label="Envoyer"
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-400 leading-snug">
                Empower est une IA : ses réponses s'appuient sur les données de la plateforme et peuvent contenir des erreurs.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouton d'ouverture flottant */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Fermer l'assistant Empower" : "Ouvrir l'assistant Empower"}
        title={isOpen ? "Fermer l'assistant" : 'Empower, assistant IA'}
        className="h-14 w-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_-5px_rgba(15,23,42,0.5)] border-2 border-white relative"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border border-white"></span>
          </span>
        )}
      </motion.button>
    </div>
  );
}
