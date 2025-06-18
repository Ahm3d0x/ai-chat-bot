/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { marked } from 'marked';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'error';
  timestamp: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!process.env.API_KEY) {
        // This is a placeholder for where API key validation would occur.
        // In a real build environment, process.env.API_KEY would be set.
        // For local development, this check might trigger if not properly set up.
        console.warn("API_KEY environment variable not detected in this environment. Ensure it's set for deployment.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "YOUR_API_KEY_PLACEHOLDER" }); // Fallback for local dev if not set
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash-preview-04-17',
        config: {
          systemInstruction: 'You are a helpful and friendly AI assistant. Keep your responses concise and informative. Use markdown for formatting when appropriate (e.g., lists, code blocks, bold, italics).',
        },
      });
      setChat(newChat);
      setMessages([{
        id: 'initial-ai-greeting',
        text: "Hello! I'm your friendly AI assistant. How can I help you today?",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (e: any) {
      console.error("Initialization error:", e);
      const initErrorMessage = `Initialization failed: ${e.message}. Please ensure the API_KEY is correctly configured. If running locally, you might need to set it up.`;
      setError(initErrorMessage);
      setMessages(prev => [...prev, {
        id: 'init-error',
        text: initErrorMessage,
        sender: 'error',
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chat) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const currentAiMessageId = `ai-${Date.now()}`;
      // Add a placeholder for the AI message that will be streamed
      setMessages(prev => [...prev, { id: currentAiMessageId, text: '', sender: 'ai', timestamp: new Date().toLocaleTimeString() }]);

      const stream = await chat.sendMessageStream({ message: currentInput });
      let currentText = '';
      for await (const chunk of stream) {
        currentText += chunk.text;
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === currentAiMessageId ? { ...msg, text: currentText } : msg
          )
        );
      }
       // Final update for the timestamp after full message is received
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === currentAiMessageId ? { ...msg, text: currentText, timestamp: new Date().toLocaleTimeString() } : msg
        )
      );

    } catch (apiError: any) {
      console.error('API Error:', apiError);
      const errorMessageText = `Sorry, I encountered an error processing your request: ${apiError.message || 'Unknown error'}. Please try again. If the problem persists, the API key might be invalid or there could be a network issue.`;
      setError(errorMessageText); // Set error state to display it below input
      setMessages(prev => [...prev, { // Also add to messages list
        id: `error-${Date.now()}`,
        text: errorMessageText,
        sender: 'error',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container" aria-live="polite">
      <header className="chat-header">AI Chat Bot</header>
      <div className="chat-messages" role="log">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.sender}`} aria-label={`${msg.sender} message at ${msg.timestamp}`}>
            {msg.sender === 'ai' || msg.sender === 'error' ? (
              <div
                className="message-content"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
              />
            ) : (
              <div className="message-content">{msg.text}</div>
            )}
            <div className="message-timestamp">{msg.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>AI is thinking...</span>
        </div>
      )}
      {error && !isLoading && ( // Display general error if not loading
        <div className="error-display" role="alert">
          <p>{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="Chat input"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  // Remove the initial loading message once React is ready
  const initialLoadingMessage = rootElement.querySelector('.loading-initial');
  if (initialLoadingMessage) {
    initialLoadingMessage.remove();
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element. Chat application cannot be started.");
  const body = document.body;
  const errorDiv = document.createElement('div');
  errorDiv.textContent = "Error: Could not load the chat application. Root HTML element not found.";
  errorDiv.style.color = "red";
  errorDiv.style.textAlign = "center";
  errorDiv.style.padding = "20px";
  body.insertBefore(errorDiv, body.firstChild);
}
