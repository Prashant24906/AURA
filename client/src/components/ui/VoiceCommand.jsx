import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, X, ChevronDown, ChevronUp, Activity } from 'lucide-react';

// All available voice commands — mirrors the Traffic Model's speech_handler.py logic
const VOICE_COMMANDS = [
  { phrase: 'go to dashboard',   aliases: ['dashboard', 'home', 'overview'],          action: 'navigate', value: '/',             desc: 'Open Dashboard' },
  { phrase: 'go to live feed',   aliases: ['live feed', 'live', 'cameras', 'feed'],   action: 'navigate', value: '/live-feed',    desc: 'Open Live Feed' },
  { phrase: 'go to incidents',   aliases: ['incidents', 'alerts list', 'reports'],    action: 'navigate', value: '/incidents',    desc: 'Open Incidents' },
  { phrase: 'go to analytics',   aliases: ['analytics', 'stats', 'statistics', 'data'], action: 'navigate', value: '/analytics', desc: 'Open Analytics' },
  { phrase: 'go to upload',      aliases: ['upload', 'analyze', 'scan image', 'detect image'], action: 'navigate', value: '/upload', desc: 'Open Upload & Analyze' },
  { phrase: 'go to settings',    aliases: ['settings', 'preferences', 'profile'],     action: 'navigate', value: '/settings',    desc: 'Open Settings' },
  { phrase: 'detect traffic',    aliases: ['traffic', 'check traffic', 'heavy traffic', 'scan traffic'], action: 'navigate', value: '/upload?model=traffic', desc: 'Detect Traffic' },
  { phrase: 'detect fire',       aliases: ['fire', 'check fire', 'fire detection'],   action: 'navigate', value: '/upload?model=fire',    desc: 'Detect Fire' },
  { phrase: 'detect garbage',    aliases: ['garbage', 'trash', 'waste', 'litter'],    action: 'navigate', value: '/upload?model=garbage', desc: 'Detect Garbage' },
  { phrase: 'detect pothole',    aliases: ['pothole', 'road damage', 'road crack'],   action: 'navigate', value: '/upload?model=pothole', desc: 'Detect Pothole' },
  { phrase: 'detect parking',    aliases: ['parking', 'illegal parking'],             action: 'navigate', value: '/upload?model=parking', desc: 'Detect Parking' },
  { phrase: 'show status',       aliases: ['status', 'info', 'model status', 'system status'], action: 'notify', value: 'status', desc: 'System Status' },
  { phrase: 'show alerts',       aliases: ['show alerts', 'recent alerts', 'notifications'], action: 'notify', value: 'alerts', desc: 'Show Recent Alerts' },
  { phrase: 'help',              aliases: ['help', 'commands', 'what can you do'],    action: 'notify', value: 'help',   desc: 'Show Help' },
];

function matchCommand(transcript) {
  const text = transcript.toLowerCase().trim();
  for (const cmd of VOICE_COMMANDS) {
    const allPhrases = [cmd.phrase, ...cmd.aliases];
    if (allPhrases.some(p => text.includes(p))) return cmd;
  }
  return null;
}

export default function VoiceCommand({ onNavigate, onStatus }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // info | success | error
  const [showPanel, setShowPanel] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pulseRings, setPulseRings] = useState(false);
  const [history, setHistory] = useState([]);
  const recognitionRef = useRef(null);
  const synth = window.speechSynthesis;

  const speak = useCallback((text) => {
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.1;
    utter.volume = 0.85;
    // Prefer a female-ish voice if available
    const voices = synth.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('zira') ||
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('google uk')
    );
    if (preferred) utter.voice = preferred;
    synth.speak(utter);
  }, [synth]);

  const showFeedback = useCallback((msg, type = 'info') => {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(''), 4000);
  }, []);

  const handleCommand = useCallback((cmd, raw) => {
    const entry = { cmd: raw, matched: cmd?.desc || '—', time: new Date().toLocaleTimeString() };
    setHistory(prev => [entry, ...prev].slice(0, 8));

    if (!cmd) {
      showFeedback(`Unknown: "${raw}"`, 'error');
      speak('Command not recognized. Say help for available commands.');
      return;
    }

    if (cmd.action === 'navigate') {
      showFeedback(`Navigating to ${cmd.desc}`, 'success');
      speak(`Opening ${cmd.desc}`);
      onNavigate?.(cmd.value);
    } else if (cmd.action === 'notify') {
      if (cmd.value === 'help') {
        setShowHelp(true);
        speak('Here are the available voice commands.');
        showFeedback('Showing available commands', 'info');
      } else if (cmd.value === 'status') {
        speak('A U R A system is online. All detection models are active.');
        showFeedback('AURA system is online. All models active.', 'success');
        onStatus?.();
      } else if (cmd.value === 'alerts') {
        speak('Navigating to incidents for recent alerts.');
        onNavigate?.('/incidents');
        showFeedback('Opening incidents page', 'info');
      }
    }
  }, [onNavigate, onStatus, speak, showFeedback]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showFeedback('Speech recognition not supported in this browser.', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setPulseRings(true);
      setTranscript('');
      showFeedback('Listening…', 'info');
      speak('Listening');
    };

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        recognition.stop();
        handleCommand(matchCommand(final), final);
      }
    };

    recognition.onerror = (e) => {
      setIsListening(false);
      setPulseRings(false);
      
      let tip = `Mic error: ${e.error}`;
      if (e.error === 'network') tip = "Network Error: Speech Recognition requires an active internet connection (Google Cloud).";
      if (e.error === 'no-speech') tip = "No speech detected. Please try again.";
      if (e.error === 'not-allowed') tip = "Microphone access denied. Please check site permissions.";
      if (e.error === 'audio-capture') tip = "No microphone found. Please connect a mic.";

      showFeedback(tip, 'error');
    };

    recognition.onend = () => {
      setIsListening(false);
      setPulseRings(false);
    };

    recognition.start();
  }, [handleCommand, showFeedback, speak]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setPulseRings(false);
    synth?.cancel();
  }, [synth]);

  // Keyboard shortcut: Ctrl+Shift+V
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        isListening ? stopListening() : startListening();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isListening, startListening, stopListening]);

  const feedbackColors = {
    info:    'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    success: 'border-green-500/40 text-green-300 bg-green-500/10',
    error:   'border-red-500/40   text-red-300   bg-red-500/10',
  };

  return (
    <>
      {/* Floating mic button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* Expandable panel */}
        {showPanel && (
          <div className="w-80 rounded-2xl border border-white/10 bg-[#0d1526]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                <span className="text-sm font-semibold text-white font-mono">AURA Voice Control</span>
              </div>
              <button onClick={() => setShowPanel(false)}
                className="text-slate-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Waveform / transcript display */}
            <div className="px-4 py-3">
              <div className={`h-14 rounded-xl border flex items-center justify-center text-sm transition-all duration-300 ${
                isListening
                  ? 'border-cyan-500/50 bg-cyan-500/5 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-500'
              }`}>
                {isListening ? (
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i}
                        className="w-[3px] bg-cyan-400 rounded-full animate-bounce"
                        style={{
                          height: `${8 + Math.random() * 20}px`,
                          animationDelay: `${i * 80}ms`,
                          animationDuration: '600ms'
                        }}
                      />
                    ))}
                    <span className="ml-2 text-xs text-cyan-400">Listening…</span>
                  </div>
                ) : transcript ? (
                  <span className="px-3 text-center text-white text-xs leading-relaxed">"{transcript}"</span>
                ) : (
                  <span className="text-xs">Press mic or Ctrl+Shift+V</span>
                )}
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mx-4 mb-3 px-3 py-2 rounded-lg border text-xs font-mono transition-all ${feedbackColors[feedbackType]}`}>
                {feedback}
              </div>
            )}

            {/* Command History */}
            {history.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Recent</p>
                <div className="space-y-1">
                  {history.slice(0, 4).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate max-w-[140px]">"{h.cmd}"</span>
                      <span className="text-cyan-400/80 ml-2 shrink-0">{h.matched}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help toggle */}
            <button
              onClick={() => setShowHelp(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Available Commands</span>
              {showHelp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showHelp && (
              <div className="max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {VOICE_COMMANDS.map((cmd) => (
                  <div key={cmd.phrase}
                    className="flex items-center gap-2 px-4 py-2 border-t border-white/5 hover:bg-white/5 transition-colors cursor-default">
                    <Volume2 size={10} className="text-cyan-500 shrink-0" />
                    <div>
                      <p className="text-[11px] text-white font-mono">"{cmd.phrase}"</p>
                      <p className="text-[10px] text-slate-500">{cmd.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main mic button */}
        <div className="relative">
          {/* Pulse rings when listening */}
          {pulseRings && (
            <>
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
              <div className="absolute inset-[-8px] rounded-full border border-cyan-400/30 animate-pulse" />
            </>
          )}

          <button
            onClick={() => {
              if (!showPanel) setShowPanel(true);
              isListening ? stopListening() : startListening();
            }}
            title={isListening ? 'Stop (Ctrl+Shift+V)' : 'Start voice command (Ctrl+Shift+V)'}
            className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 border-2 ${
              isListening
                ? 'bg-red-500 border-red-400 shadow-red-500/40 scale-110'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400/60 shadow-cyan-500/30 hover:scale-105'
            }`}
          >
            {isListening
              ? <MicOff size={22} className="text-white" />
              : <Mic size={22} className="text-white" />
            }
          </button>

          {/* Toggle panel chevron */}
          {!isListening && (
            <button
              onClick={() => setShowPanel(v => !v)}
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-slate-700 border border-white/20 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {showPanel ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
