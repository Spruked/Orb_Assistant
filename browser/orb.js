const { useEffect, useRef, useState } = React;
const { createRoot } = ReactDOM;

// LEGACY — NOT USED BY ORB_ASSISTANT
// This file is a browser-only preview/prototype and should NOT be used in the Electron production path.
// The Electron app uses explicit ORB channels via FloatingOrb.jsx.

// Simple linear interpolation helper used by movement logic
const lerp = (a, b, t) => a + (b - a) * t;
const normalizeText = (s) => (s || '').toLowerCase().trim();
// TODO: Replace hardcoded name with a user profile value when settings UI is added.
const buildGreeting = () => "I'm here. How can I help, Bryan?";
const ucmWsUrl = "ws://localhost:8000/ws/orb/CALI_UNIT_01";

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Local mood fallback so the orb feels responsive even without bridge health
const moodFromLocalSignals = ({ isListening, isSpeaking, cursorDist, idleMs }) => {
  let mood = 0.75;

  if (isSpeaking) mood += 0.15;
  if (isListening) mood += 0.05;

  if (cursorDist < 120) mood -= 0.2;
  else if (cursorDist < 220) mood -= 0.1;

  if (idleMs > 15000) mood += 0.1;

  return clamp01(mood);
};

const colorForHealth = (h) => {
  if (h >= 0.8) return '#2dd4ff';
  if (h >= 0.6) return '#facc15';
  return '#f87171';
};

const resolveBridgeUrl = (fallbackUrl) => {
  if (typeof window === 'undefined') return fallbackUrl;
  const plugin = window.UCM_4_Core;
  if (plugin && (plugin.bridgeUrl || plugin.ws)) {
    return plugin.bridgeUrl || plugin.ws;
  }
  return fallbackUrl;
};

function OrbSurface({ bridgeUrl = 'ws://localhost:9876' }) {
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const [resolvedBridgeUrl, setResolvedBridgeUrl] = useState(bridgeUrl);
  const [health, setHealth] = useState(1.0);
  const [status, setStatus] = useState('Connecting to CALI...');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastText, setLastText] = useState('');
  const [permissions, setPermissions] = useState({
    desktop: true,
    browser: true,
    voice: true,
    listening: true,
  });

  const [viewport, setViewport] = useState({
    w: Math.max(window.innerWidth, document.documentElement.clientWidth || 0, window.outerWidth || 0),
    h: Math.max(window.innerHeight, document.documentElement.clientHeight || 0, window.outerHeight || 0),
  });
  const [pos, setPos] = useState({ x: viewport.w / 2, y: viewport.h / 2 });
  const posRef = useRef(pos);
  const targetRef = useRef(pos);
  const summonRef = useRef(false);
  const cursorDistRef = useRef(9999);
  const lastMoveRef = useRef(Date.now());
  const wakeRef = useRef('hey orb');
  const lastHeardRef = useRef('');
  const speechRecRef = useRef(null);

  const summonToCenter = () => {
    const x = viewport.w / 2;
    const y = viewport.h / 2;
    targetRef.current = { x, y };
    setStatus('Summoned');
  };

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    setResolvedBridgeUrl(resolveBridgeUrl(bridgeUrl));
  }, [bridgeUrl]);

  // Basic avoid/follow cursor behavior
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        w: Math.max(window.innerWidth, document.documentElement.clientWidth || 0, window.outerWidth || 0),
        h: Math.max(window.innerHeight, document.documentElement.clientHeight || 0, window.outerHeight || 0),
      });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      lastMoveRef.current = Date.now();
      const cursor = { x: e.clientX, y: e.clientY };
      const dx = posRef.current.x - cursor.x;
      const dy = posRef.current.y - cursor.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: 'update_cursor',
            cursorX: e.clientX,
            cursorY: e.clientY,
            screenWidth: viewport.w,
            screenHeight: viewport.h,
          })
        );
      }

      const keepAway = 160; // preferred standoff distance (slightly more comfortable)
      const band = 140;     // wider band to keep following
      const far = keepAway + band;

      let tx = posRef.current.x;
      let ty = posRef.current.y;

      if (dist < keepAway) {
        // Push directly away to maintain standoff
        const factor = keepAway / dist;
        tx = cursor.x + dx * factor;
        ty = cursor.y + dy * factor;
      } else if (dist > far) {
        // Pull toward cursor more decisively but ease in
        const factor = (dist - far) / dist;
        tx = lerp(posRef.current.x, cursor.x, 0.16 + factor * 0.25);
        ty = lerp(posRef.current.y, cursor.y, 0.16 + factor * 0.25);
      } else {
        // In band: bias slightly toward cursor to keep it near
        tx = lerp(posRef.current.x, cursor.x, 0.08);
        ty = lerp(posRef.current.y, cursor.y, 0.08);
      }

      const margin = 40;
      const clampedX = Math.min(viewport.w - margin, Math.max(margin, tx));
      const clampedY = Math.min(viewport.h - margin, Math.max(margin, ty));
      cursorDistRef.current = dist;
      targetRef.current = { x: clampedX, y: clampedY };

      if (summonRef.current) {
        targetRef.current = { x: cursor.x, y: cursor.y };
        if (dist < keepAway + 20) summonRef.current = false;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [viewport]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this environment.');
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = normalizeText(result?.[0]?.transcript || '');
      if (!transcript) return;

      lastHeardRef.current = transcript;

      if (transcript.includes(wakeRef.current)) {
        summonRef.current = true;
        summonToCenter();
        if ('speechSynthesis' in window) {
          speak(buildGreeting());
        }
      }
    };

    recognition.onerror = (err) => {
      console.warn('Speech recognition error:', err);
    };

    recognition.onend = () => {
      // Auto-restart to feel always-on
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition restart failed:', err);
      }
    };

    speechRecRef.current = recognition;
    recognition.start();

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, [viewport]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        summonRef.current = true;
        setStatus('Summoned');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    let rafId;
    const tick = () => {
      const curr = posRef.current;
      const tgt = targetRef.current;
      const next = {
        x: lerp(curr.x, tgt.x, 0.28),
        y: lerp(curr.y, tgt.y, 0.28),
      };
      posRef.current = next;
      setPos(next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(ucmWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('UCM orb linked');
      setIsListening(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'position_update' && msg.position) {
          targetRef.current = {
            x: msg.position.x,
            y: msg.position.y,
          };
        }

        if (msg.type === 'PULSE') {
          // Optional: drive glow/intensity from msg.intensity
          // Example: setHealth(clamp01(msg.intensity));
        }

        if (msg.type === 'query_response') {
          setLastText(msg.answer || '');
          setStatus('Response received');
        }

        if (msg.type === 'error') {
          setStatus(`UCM error: ${msg.message}`);
        }
      } catch (err) {
        console.error('UCM parse error', err);
      }
    };

    ws.onclose = () => {
      setStatus('UCM disconnected');
      setIsListening(false);
    };

    ws.onerror = (err) => {
      console.error('UCM WS error', err);
      ws.close();
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(resolvedBridgeUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          setStatus(
            resolvedBridgeUrl !== bridgeUrl ? 'UCM_4_Core linked via plugin bridge' : 'Orb linked to CALI'
          );
          setIsListening(true);
          ws.send(JSON.stringify({ type: 'orb_status_request' }));
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'cali_status') {
              const h = msg.data?.health ?? 1.0;
              setHealth(h);
              setStatus('Cognition online');
            } else if (msg.type === 'query_result') {
              const text = msg.data?.text || msg.data?.state?.text || 'Response received';
              setLastText(text);
              setHealth(msg.data?.confidence ?? health);
              if ((msg.data?.confidence ?? 0) > 0.75) speak(text);
            } else if (msg.type === 'status_response') {
              const h = msg.data?.health_score ?? 1.0;
              setHealth(h);
              setStatus(`Orb healthy (${(h * 100).toFixed(0)}%)`);
            }
          } catch (err) {
            console.error('Orb parse error', err);
          }
        };
        ws.onclose = () => {
          setStatus('Bridge disconnected – retrying...');
          setIsListening(false);
          retryRef.current = setTimeout(connect, 2000);
        };
        ws.onerror = (err) => {
          console.error('Bridge error', err);
          ws.close();
        };
      } catch (err) {
        console.error('Bridge connection failed', err);
        retryRef.current = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [bridgeUrl, resolvedBridgeUrl]);

  const handleClick = () => {
    const text = window.prompt('Ask CALI:', lastText || '');
    if (!text) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'orb_query', text, core: 'kaygee' }));
      setStatus('Query dispatched...');
    }
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const idleMs = Date.now() - lastMoveRef.current;
  const localMood = moodFromLocalSignals({
    isListening,
    isSpeaking,
    cursorDist: cursorDistRef.current,
    idleMs,
  });
  const baseHealth = Number.isFinite(health) ? health : localMood;
  const blended = clamp01(lerp(baseHealth, localMood, 0.35));
  const color = colorForHealth(blended);
  const coreClasses = ['orb-core'];
  if (isListening) coreClasses.push('listening');
  if (isSpeaking) coreClasses.push('speaking');

  const permDefs = [
    ['desktop', 'Desktop'],
    ['browser', 'Browser'],
    ['voice', 'Voice'],
    ['listening', 'Listening'],
  ];

  return React.createElement(
    'div',
    {
      className: 'orb-container',
      onClick: handleClick,
      title: 'Click to ask CALI',
      style: { left: pos.x, top: pos.y },
    },
    React.createElement(
      'div',
      { className: coreClasses.join(' '), style: { color } },
      React.createElement('div', { className: 'orb-glow', style: { background: color } }),
      React.createElement(
        'div',
        { className: 'orb-rings' },
        React.createElement('span'),
        React.createElement('span'),
        React.createElement('span')
      )
    ),
    React.createElement(
      'div',
      { className: 'orb-status' },
      React.createElement('strong', null, `${(health * 100).toFixed(0)}%`),
      React.createElement('span', null, status)
    ),
    React.createElement(
      'div',
      {
        className: 'permission-toggles',
        onClick: (e) => e.stopPropagation(),
      },
      permDefs.map(([key, label]) =>
        React.createElement(
          'div',
          {
            key,
            className: `permission-toggle ${permissions[key] ? 'on' : 'off'}`,
            onClick: () => togglePermission(key),
            title: `${label} permission: ${permissions[key] ? 'on' : 'off'}`,
          },
          React.createElement('span', { className: 'dot' }),
          React.createElement('span', null, label)
        )
      )
    )
  );
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(OrbSurface));
