// Simple vanilla JS orb for Electron
const clamp01 = (n) => Math.max(0, Math.min(1, n));

const colorForHealth = (h) => {
  if (h >= 0.8) return '#4ade80';
  if (h >= 0.6) return '#86efac';
  return '#22c55e';
};

class SimpleOrb {
  constructor() {
    this.health = 1.0;
    this.isListening = false;
    this.isSpeaking = false;
    this.status = 'Initializing CALI...';
    this.lastText = '';
    this.cognitiveMode = 'GUARD';
    this.glowIntensity = 0.5;
    this.displayName = 'Caleon (CALI)';
    this.size = 200;
    this.position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.targetPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.lerpFactor = 0.08;
    this.avoidanceDistance = 300;
    this.followDistance = 350;
    this.init();
  }

  init() {
    this.createElements();
    this.setupEventListeners();
    this.connectToAPI();
    this.connectToUCM();
    this.startAnimationLoop();
  }

  createElements() {
    const shell = document.createElement('div');
    shell.className = 'living-orb-shell';
    shell.onclick = () => this.handleClick();
    shell.style.left = `${this.position.x - this.size / 2}px`;
    shell.style.top = `${this.position.y - this.size / 2}px`;
    shell.style.right = 'auto';
    shell.style.position = 'fixed';

    const core = document.createElement('div');
    core.className = 'living-orb-core';

    const glow = document.createElement('div');
    glow.className = 'living-orb-glow';

    const rings = document.createElement('div');
    rings.className = 'living-orb-rings';
    for (let i = 0; i < 3; i++) {
      rings.appendChild(document.createElement('span'));
    }

    const surface = document.createElement('div');
    surface.className = 'living-orb-surface';

    core.appendChild(glow);
    core.appendChild(rings);
    core.appendChild(surface);

    const status = document.createElement('div');
    status.className = 'living-orb-status';
    status.innerHTML = `
      <strong>${this.displayName}</strong>
      <span>${this.status}</span>
    `;

    shell.appendChild(core);
    shell.appendChild(status);

    document.body.appendChild(shell);

    this.shell = shell;
    this.core = core;
    this.statusEl = status;
  }

  updatePosition() {
    if (this.shell) {
      this.shell.style.left = `${this.position.x - this.size / 2}px`;
      this.shell.style.top = `${this.position.y - this.size / 2}px`;
      this.shell.style.width = `${this.size}px`;
      this.shell.style.height = `${this.size}px`;
    }
  }

  setupEventListeners() {
    // Mouse tracking
    document.addEventListener('mousemove', (e) => {
      if (window.electronAPI) {
        window.electronAPI.orbCursorMove(e.clientX, e.clientY);
      }

      const cursorX = e.clientX;
      const cursorY = e.clientY;
      const dx = cursorX - this.position.x;
      const dy = cursorY - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const avoidanceDistance = this.avoidanceDistance;
      const followDistance = this.followDistance;

      if (distance < avoidanceDistance) {
        const angle = Math.atan2(dy, dx);
        const avoidDistance = avoidanceDistance * 1.3;
        const pushAngle = angle + Math.PI;
        let newTargetX = cursorX + Math.cos(pushAngle) * avoidDistance;
        let newTargetY = cursorY + Math.sin(pushAngle) * avoidDistance;

        newTargetX = Math.max(this.size / 2, Math.min(window.innerWidth - this.size / 2, newTargetX));
        newTargetY = Math.max(this.size / 2, Math.min(window.innerHeight - this.size / 2, newTargetY));

        this.targetPos = { x: newTargetX, y: newTargetY };
      } else {
        const angle = Math.atan2(dy, dx);
        let newTargetX = cursorX - Math.cos(angle) * followDistance;
        let newTargetY = cursorY - Math.sin(angle) * followDistance;

        newTargetX = Math.max(this.size / 2, Math.min(window.innerWidth - this.size / 2, newTargetX));
        newTargetY = Math.max(this.size / 2, Math.min(window.innerHeight - this.size / 2, newTargetY));

        this.targetPos = { x: newTargetX, y: newTargetY };
      }
    });
  }

  startAnimationLoop() {
    const animate = () => {
      this.position.x += (this.targetPos.x - this.position.x) * this.lerpFactor;
      this.position.y += (this.targetPos.y - this.position.y) * this.lerpFactor;

      this.shell.style.left = `${this.position.x - this.size / 2}px`;
      this.shell.style.top = `${this.position.y - this.size / 2}px`;

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  connectToAPI() {
    if (window.electronAPI) {
      // Listen for cognitive pulses
      window.electronAPI.onCognitivePulse((event, pulse) => {
        if (pulse) {
          this.updateFromPulse(pulse);
        }
      });

      // Listen for settings updates
      window.electronAPI.on('orb:settings', (event, settings) => {
        this.applySettings(settings);
      });

      // Listen for speak commands
      window.electronAPI.onSpeak((text) => {
        this.speak(text);
      });

      this.status = 'Orb linked to CALI bridge';
      this.isListening = true;
      this.updateDisplay();
    } else {
      this.status = 'Electron API not available';
      this.updateDisplay();
    }
  }

  connectToUCM() {
    try {
      this.ws = new WebSocket('ws://localhost:8000/ws/orb_assistant');
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'ORB_HANDSHAKE',
          orb_id: 'CALI_UNIT_01',
          role: 'assistant',
          capabilities: ['cursor_tracking', 'screen_awareness']
        }));
        this.status = 'Connected to UCM';
        this.updateDisplay();
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'HANDSHAKE_ACK') {
          this.status = 'UCM handshake acknowledged';
          this.updateDisplay();
        } else if (msg.type === 'lerp_optimization') {
          this.lerpFactor = msg.value || 0.12;
        } else if (msg.type === 'drift_preference') {
          // Handle drift updates
        }
      };
      this.ws.onclose = () => {
        this.status = 'UCM connection lost';
        this.updateDisplay();
      };
      this.ws.onerror = (err) => {
        this.status = 'UCM connection error';
        this.updateDisplay();
      };
    } catch (e) {
      this.status = 'Failed to connect to UCM';
      this.updateDisplay();
    }
  }

  applySettings(settings) {
    if (settings.lerp !== undefined) this.lerpFactor = settings.lerp;
    if (settings.size !== undefined) {
      this.size = settings.size;
      this.updatePosition();
    }
    if (settings.avoidance !== undefined) this.avoidanceDistance = settings.avoidance;
    if (settings.follow !== undefined) this.followDistance = settings.follow;
  }

  speak(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  }

  startAnimationLoop() {
    const animate = () => {
      // Smooth position interpolation
      this.position.x += (this.targetPos.x - this.position.x) * this.lerpFactor;
      this.position.y += (this.targetPos.y - this.position.y) * this.lerpFactor;

      // Update DOM position
      this.updatePosition();

      requestAnimationFrame(animate);
    };
    animate();
  }

  updateFromPulse(pulse) {
    this.glowIntensity = pulse.glow_intensity || 0.5;
    this.cognitiveMode = pulse.cognitive_mode || 'GUARD';
    this.health = pulse.glow_intensity || 1.0;
    this.status = 'Orb linked to CALI bridge';
    this.updateDisplay();
  }

  updateDisplay() {
    const color = colorForHealth(this.health);
    this.core.style.color = color;
    this.core.style.filter = `brightness(${0.5 + this.glowIntensity * 0.5})`;
    this.core.style.boxShadow = `0 0 ${20 + this.glowIntensity * 30}px ${color}`;

    this.statusEl.innerHTML = `
      <strong>${this.displayName}</strong>
      <span>${this.status}</span>
    `;

    // Update classes
    this.core.className = 'living-orb-core';
    if (this.isListening) this.core.classList.add('listening');
    if (this.isSpeaking) this.core.classList.add('speaking');
    if (this.cognitiveMode === 'INTUITION-JUMP') this.core.classList.add('jumping');
    if (this.cognitiveMode === 'HABIT') this.core.classList.add('habiting');
  }

  async handleClick() {
    this.speak('Orb clicked. How can I assist?');
    const promptText = prompt('Ask CALI:', this.lastText || '');
    if (!promptText) return;
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.orbQuery(promptText);
        this.lastText = result?.echo || 'Response received';
        this.status = 'Query processed';
        this.updateDisplay();
        this.speak('Response received.');
        if (result?.cognitive_result?.glow_intensity > 0.75) {
          // Simulate speaking
          this.isSpeaking = true;
          this.updateDisplay();
          setTimeout(() => {
            this.isSpeaking = false;
            this.updateDisplay();
          }, 2000);
        }
      } catch (err) {
        console.error('Query error:', err);
        this.status = 'Query failed';
        this.updateDisplay();
        this.speak('Query failed.');
      }
    }
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new SimpleOrb();
});