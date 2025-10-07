import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const OFFLINE_MESSAGE = "Our team is currently offline, but we'll be back soon!";

interface ChatbotProps {
  forceOpen?: boolean; // open on mount (for full page)
  fullScreen?: boolean; // render as full-page chat (no floating)
  openInPageOnMobile?: boolean; // when true, icon click navigates to /chat on mobile
}

export function Chatbot({ forceOpen = false, fullScreen = false, openInPageOnMobile = true }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(!!forceOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatId = useRef(Math.random().toString(36).substr(2, 9));
  const navigate = useNavigate();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const addMessage = (text: string, sender: 'user' | 'bot') => {
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      sender,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = async () => {
    const userText = inputValue.trim();
    if (!userText || isLoading) return;

    addMessage(userText, 'user');
    setInputValue('');
    setIsLoading(true);

    // Add typing indicator
    const typingMessage: Message = {
      id: 'typing',
      text: 'Typing...',
      sender: 'bot',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await fetch('https://nwh.thefutureofenglish.com/webhook/botsitelush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          chatId: chatId.current,
        }),
      });

      const data = await response.json();
      
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== 'typing'));

      const reply = data.response || OFFLINE_MESSAGE;
      addMessage(reply, 'bot');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
      
      addMessage(OFFLINE_MESSAGE, 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, index) => (
      <span key={index} className="break-words">
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div 
      className={fullScreen ? 'fixed inset-0 z-40 flex flex-col bg-white' : 'fixed bottom-6 right-6 z-50 flex flex-col items-end bg-transparent'}
      style={fullScreen ? undefined : { 
        background: 'transparent',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
        margin: 0
      }}
    >
      {/* Chat Icon */}
      {!isOpen && !fullScreen && (
        <div
          onClick={() => {
            if (openInPageOnMobile && isMobile) {
              navigate('/chat');
              return;
            }
            setIsOpen(true);
          }}
          className="relative w-16 h-16 cursor-pointer group"
          role="button"
          tabIndex={0}
          aria-label="Open chat"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (openInPageOnMobile && isMobile) {
                navigate('/chat');
              } else {
                setIsOpen(true);
              }
            }
          }}
        >
          {/* Botão principal */}
          <div className="w-16 h-16 bg-gradient-to-br from-blue-950 to-blue-900 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 flex items-center justify-center group-hover:from-blue-900 group-hover:to-blue-800">
            {/* Ícone de chat */}
            <svg 
              className="w-8 h-8 text-white transition-transform duration-300 group-hover:scale-110" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
          </div>
          
          {/* Indicador de notificação */}
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          
          {/* Efeito de ondas */}
          <div className="absolute inset-0 rounded-full bg-blue-600 opacity-20 animate-ping"></div>
          <div className="absolute inset-0 rounded-full bg-blue-500 opacity-10 animate-ping" style={{ animationDelay: '0.5s' }}></div>
        </div>
      )}

      {/* Chat Box */}
      {isOpen && (
        <div
          className={fullScreen
            ? 'w-full h-full bg-white flex flex-col overflow-hidden'
            : 'w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden'}
          style={fullScreen ? undefined : { boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}
        >
          {/* Header */}
                     <div className="bg-blue-950 px-4 py-3 flex justify-between items-center">
            <img
              src="https://lushamerica.com/logo.png"
              alt="Lush America Logo"
              className="h-6 object-contain"
            />
            <button
              onClick={() => {
                if (fullScreen) {
                  navigate(-1);
                } else {
                  setIsOpen(false);
                }
              }}
              className="text-white text-xl font-bold hover:text-gray-200 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

                     {/* Messages */}
           <div className="flex-1 p-3 bg-gray-50 overflow-y-auto min-h-0 flex flex-col">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                Welcome! How can we help you today?
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                                 className={`inline-block max-w-[75%] mb-3 p-3 rounded-xl break-words overflow-wrap-anywhere word-break-break-word ${
                   message.sender === 'user'
                     ? 'bg-blue-950 text-white self-end rounded-br-none'
                     : 'bg-gray-200 text-gray-900 self-start rounded-bl-none'
                 } ${
                   message.id === 'typing' ? 'italic animate-pulse' : ''
                 }`}
              >
                <div className="text-sm leading-relaxed">
                  {formatMessage(message.text)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-3 py-3 text-base sm:text-sm border-none outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-3 bg-blue-950 text-white hover:bg-blue-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
