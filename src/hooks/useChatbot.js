/**
 * useChatbot.js
 * React hook that manages:
 *  - ChatbotEngine lifecycle (training, inference)
 *  - Per-patient ConversationContext
 *  - Message history state
 *  - Training progress display
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatbotEngine, ConversationContext } from '../ml/ChatbotEngine';

const engine = new ChatbotEngine(); // singleton across renders

export function useChatbot(patientId, admriScore) {
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      role: 'bot',
      text: "Hi, I'm your ADMRI support assistant. I'm here to listen and help with coping techniques. How are you feeling today?",
      cbt: null,
      followUp: null,
      isCrisis: false,
      timestamp: Date.now(),
    }
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const [modelReady, setModelReady] = useState(engine.trained);
  const [trainingProgress, setTrainingProgress] = useState(engine.trainingProgress);
  const [fromCache, setFromCache] = useState(false);

  // Per-patient context — recreated when patient changes
  const contextRef = useRef(new ConversationContext());
  useEffect(() => {
    contextRef.current = new ConversationContext();
    setMessages([{
      id: 'intro',
      role: 'bot',
      text: "Hi, I'm your ADMRI support assistant. I'm here to listen and help with coping techniques. How are you feeling today?",
      cbt: null,
      followUp: null,
      isCrisis: false,
      timestamp: Date.now(),
    }]);
  }, [patientId]);

  // Train model on mount (only once — subsequent calls are near-instant cache loads)
  useEffect(() => {
    if (engine.trained) {
      setModelReady(true);
      return;
    }
    engine.train((progress, loss) => {
      setTrainingProgress(progress);
    }).then(result => {
      setModelReady(true);
      setFromCache(result?.fromCache ?? false);
    }).catch(err => {
      console.error('Chatbot training failed:', err);
      setModelReady(true); // still allow fallback responses
    });
  }, []);

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim()) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Small delay for UX realism
      await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
      const response = await engine.respond(userText, contextRef.current, admriScore);

      const botMsg = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: response.text,
        cbt: response.cbt,
        followUp: response.followUp,
        isCrisis: response.isCrisis,
        helplines: response.helplines,
        intent: response.intent,
        confidence: response.confidence,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'bot',
        text: "I had trouble processing that. Please try again.",
        isCrisis: false,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [admriScore]);

  const clearHistory = useCallback(() => {
    contextRef.current = new ConversationContext();
    setMessages([{
      id: 'intro',
      role: 'bot',
      text: "Conversation cleared. How are you feeling right now?",
      cbt: null,
      followUp: null,
      isCrisis: false,
      timestamp: Date.now(),
    }]);
  }, []);

  const retrainModel = useCallback(async () => {
    setModelReady(false);
    setTrainingProgress(0);
    await engine.clearCache();
    engine.train((progress) => {
      setTrainingProgress(progress);
    }).then(result => {
      setModelReady(true);
      setFromCache(result?.fromCache ?? false);
    });
  }, []);

  return {
    messages,
    isTyping,
    modelReady,
    trainingProgress,
    fromCache,
    sendMessage,
    clearHistory,
    retrainModel,
  };
}
