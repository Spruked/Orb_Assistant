const { PythonShell } = require('python-shell');
const path = require('path');

class OrbBridge {
  constructor() {
    this.pythonProcess = null;
    this.messageHandlers = new Set();
    this._readyResolved = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      const options = {
        mode: 'text',
        pythonPath: 'C:\\Users\\bryan\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
        pythonOptions: ['-u'],
        scriptPath: path.join(__dirname, '..', 'src'),
        args: [],
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          // Clear conda environment variables
          CONDA_DEFAULT_ENV: undefined,
          CONDA_PREFIX: undefined,
          CONDA_PROMPT_MODIFIER: undefined,
          CONDA_SHLVL: undefined
        }
      };

      console.log('Orb Bridge: Using Python path:', options.pythonPath);
      console.log('Orb Bridge: Script path:', options.scriptPath);

      this.pythonProcess = new PythonShell('floating_assistant_orb.py', options);

      this.pythonProcess.on('message', (rawMessage) => {
        let message;
        try {
            message = JSON.parse(rawMessage);
        } catch (e) {
            console.log('Orb Python stdout:', rawMessage);
            return;
        }

        // Forward to listeners
        this.messageHandlers.forEach((handler) => handler(message));

        // Resolve on first ready signal
        if (!this._readyResolved && message && message.type === 'ready') {
          this._readyResolved = true;
          this._removeHandler(readyHandler);
          resolve();
        }
      });

      this.pythonProcess.on('stderr', (stderr) => {
        console.error('Orb Python stderr:', stderr);
      });

      this.pythonProcess.on('error', (err) => {
        console.error('Failed to start orb:', err);
        reject(err);
      });

      this.pythonProcess.on('close', (code) => {
        console.log(`Orb process exited with code ${code}`);
      });

      const readyHandler = (msg) => {
        if (msg && msg.type === 'ready' && !this._readyResolved) {
          this._readyResolved = true;
          this._removeHandler(readyHandler);
          resolve();
        }
      };
      this.messageHandlers.add(readyHandler);

      // Timeout safety
      setTimeout(() => {
        if (!this._readyResolved) {
          this._removeHandler(readyHandler);
          reject(new Error('Orb startup timeout'));
        }
      }, 60000);
    });
  }

  stop() {
    if (this.pythonProcess) {
      try {
        this.pythonProcess.send({ type: 'shutdown' });
      } catch (err) {
        console.error('Error sending shutdown to orb:', err);
      }
      this.pythonProcess.end(() => {});
      this.pythonProcess = null;
    }
  }

  sendMessage(message) {
    if (!this.pythonProcess) {
      throw new Error('Orb not started');
    }
    this.pythonProcess.send(message);
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
  }

  removeMessageHandler(handler) {
    this._removeHandler(handler);
  }

  _removeHandler(handler) {
    if (this.messageHandlers.has(handler)) {
      this.messageHandlers.delete(handler);
    }
  }
}

module.exports = { OrbBridge };