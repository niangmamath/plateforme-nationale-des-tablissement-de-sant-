/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      type: 'bot', 
      text: "Bonjour Docteur. Je suis votre IA d'intelligence géospatiale. Cherchez-vous un emplacement optimal pour votre futur cabinet ?" 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    // 1. Ajouter le message de l'utilisateur
    const userText = inputValue;
    const historique = [...messages, { id: Date.now(), type: 'user' as const, text: userText }];
    setMessages(historique);
    setInputValue("");
    setIsTyping(true);

    // 2. Appeler le vrai backend (Gemini + données réelles de la base)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historique.map((m) => ({ role: m.type === 'user' ? 'user' : 'model', text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: data.text || "Je n'ai pas de réponse à vous proposer pour l'instant." }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: "Désolé, une erreur est survenue en interrogeant l'assistant (" + (err?.message || 'inconnue') + "). Réessayez dans un instant." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header du Chatbot */}
            <div className="bg-slate-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-white text-sm font-black tracking-wide">Assistant IA GeoMed</h3>
                  <p className="text-slate-400 text-[10px] font-semibold">Conseiller d'implantation B2B</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-1 ${msg.type === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-700'}`}>
                      {msg.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`p-3 text-[13px] leading-relaxed shadow-sm ${
                      msg.type === 'user' 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                        : 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm font-medium'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="shrink-0 h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mt-1">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex gap-1 items-center h-[42px]">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez votre question (ex: Je suis dermato...)" 
                  className="flex-1 bg-transparent text-sm px-3 py-2 outline-none text-slate-700 placeholder:text-slate-400"
                />
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouton d'ouverture flottant */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
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