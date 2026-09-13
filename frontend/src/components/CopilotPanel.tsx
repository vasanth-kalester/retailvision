import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, Bot, AlertTriangle, ArrowRight } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onClose?: () => void;
}

export default function CopilotPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I am your Retail Edge Copilot. How can I help you manage the store today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error: Could not connect to the edge analytics server.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTIONS = [
    "What's the checkout queue status?",
    "Where is the busiest zone?",
    "Are there any security alerts?",
    "How many people entered today?"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)' }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={20} /> RetailEdge AI Copilot
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.role === 'user' ? 'var(--primary-blue-light)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyItems: 'center', flexShrink: 0 }}>
              {msg.role === 'user' ? <User size={14} color="var(--primary-blue)" style={{ margin: 'auto' }} /> : <Bot size={14} color="var(--text-secondary)" style={{ margin: 'auto' }} />}
            </div>
            <div style={{ background: msg.role === 'user' ? 'var(--primary-blue)' : 'var(--bg-panel)', padding: '0.75rem 1rem', borderRadius: 12, borderTopRightRadius: msg.role === 'user' ? 0 : 12, borderTopLeftRadius: msg.role === 'assistant' ? 0 : 12, fontSize: '0.875rem', color: msg.role === 'user' ? 'white' : 'var(--text-primary)', maxWidth: '85%', lineHeight: 1.5, border: msg.role === 'assistant' ? '1px solid var(--border-light)' : 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {/* Parse basic markdown bolding */}
              {msg.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: msg.role === 'user' ? '#fff' : 'var(--text-primary)' }}>{part}</strong> : part)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={14} color="var(--text-secondary)" />
            </div>
            <div style={{ background: 'var(--bg-panel)', padding: '0.75rem 1rem', borderRadius: 12, borderTopLeftRadius: 0, fontSize: '0.875rem', border: '1px solid var(--border-light)', display: 'flex', gap: 4 }}>
              <span className="dot-typing"></span><span className="dot-typing" style={{ animationDelay: '0.2s' }}></span><span className="dot-typing" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-strong)', background: 'var(--bg-panel)' }}>
        {/* Suggestions */}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {SUGGESTIONS.map((sug, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(sug)}
                style={{ background: 'var(--primary-blue-light)', border: '1px solid var(--primary-blue-border)', borderRadius: 99, padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--primary-blue)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
              >
                {sug} <ArrowRight size={10} />
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={e => { e.preventDefault(); handleSend(input); }} style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Copilot..." 
            style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            style={{ background: 'var(--primary-blue)', border: 'none', borderRadius: 8, width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed', opacity: input.trim() && !isLoading ? 1 : 0.5 }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
