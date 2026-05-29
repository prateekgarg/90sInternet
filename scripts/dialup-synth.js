// 90s Internet Simulator - Web Audio API Dial-up Sound Synthesizer

class DialUpSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.isPlaying = false;
    this.stopCallback = null;
  }

  // Create or resume AudioContext
  initAudio() {
    if (!this.audioCtx) {
      // Support vendor prefixes just in case
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    // Master gain node to control overall volume and smooth endings
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(0.2, this.audioCtx.currentTime); // keep it retro but not deafening
    this.masterGain.connect(this.audioCtx.destination);
  }

  // Play the entire sequence
  play(onComplete) {
    if (this.isPlaying) {
      this.stop();
    }

    try {
      this.initAudio();
    } catch (e) {
      console.error("Web Audio API not supported or blocked: ", e);
      if (onComplete) onComplete();
      return;
    }

    this.isPlaying = true;
    this.stopCallback = onComplete;
    this.activeNodes = [];

    const now = this.audioCtx.currentTime;
    let time = now;

    // 1. Off-hook & Dial Tone (350 Hz + 440 Hz)
    const dialTone1 = this.playDualTone(350, 440, time, 1.2);
    time += 1.2;

    // 2. DTMF Dialing (Mocking dialing ISP number: 7-0-8-3-0-1-2)
    const digits = [
      { low: 852, high: 1336 }, // '7'
      { low: 941, high: 1336 }, // '0'
      { low: 852, high: 1336 }, // '8'
      { low: 697, high: 1477 }, // '3'
      { low: 941, high: 1336 }, // '0'
      { low: 697, high: 1209 }, // '1'
      { low: 697, high: 1336 }  // '2'
    ];

    digits.forEach((digit) => {
      // Dial sound
      this.playDualTone(digit.low, digit.high, time, 0.08);
      time += 0.08;
      // Brief pause between digits
      time += 0.06;
    });

    // Pause before ring
    time += 0.5;

    // 3. Ringback Tone (440 Hz + 480 Hz, 1 ring)
    this.playDualTone(440, 480, time, 1.2);
    time += 1.2;

    // Silence while waiting for answer
    time += 0.6;

    // 4. Answer Tone (2100 Hz high beep)
    const ansTone = this.audioCtx.createOscillator();
    const ansGain = this.audioCtx.createGain();
    
    ansTone.type = "sine";
    ansTone.frequency.setValueAtTime(2100, time);
    
    ansGain.gain.setValueAtTime(0, time);
    ansGain.gain.linearRampToValueAtTime(0.8, time + 0.05);
    ansGain.gain.setValueAtTime(0.8, time + 1.2);
    ansGain.gain.linearRampToValueAtTime(0, time + 1.3);

    ansTone.connect(ansGain);
    ansGain.connect(this.masterGain);
    
    ansTone.start(time);
    ansTone.stop(time + 1.3);
    
    this.activeNodes.push(ansTone);
    time += 1.4;

    // 5. Phase 1 Whistles / Sweeps (Modulation Handshake)
    const sweepOsc = this.audioCtx.createOscillator();
    const sweepGain = this.audioCtx.createGain();
    
    sweepOsc.type = "sine";
    // Sweeps up and down
    sweepOsc.frequency.setValueAtTime(600, time);
    sweepOsc.frequency.linearRampToValueAtTime(2200, time + 0.5);
    sweepOsc.frequency.setValueAtTime(2200, time + 0.5);
    sweepOsc.frequency.linearRampToValueAtTime(1200, time + 1.0);
    sweepOsc.frequency.setValueAtTime(1200, time + 1.0);
    sweepOsc.frequency.linearRampToValueAtTime(1800, time + 1.3);
    
    sweepGain.gain.setValueAtTime(0, time);
    sweepGain.gain.linearRampToValueAtTime(0.6, time + 0.05);
    sweepGain.gain.setValueAtTime(0.6, time + 1.3);
    sweepGain.gain.linearRampToValueAtTime(0, time + 1.4);

    sweepOsc.connect(sweepGain);
    sweepGain.connect(this.masterGain);
    
    sweepOsc.start(time);
    sweepOsc.stop(time + 1.4);
    
    this.activeNodes.push(sweepOsc);
    time += 1.4;

    // 6. Modem Screech & Training Static (Harsh white noise + AM/FM chugging)
    // Create White Noise
    const bufferSize = this.audioCtx.sampleRate * 4.5; // 4.5 seconds of screeching
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter to make noise sound like static over a telephone line
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.Q.setValueAtTime(1.5, time);
    // Animate filter center frequency to simulate varying modem protocols
    noiseFilter.frequency.setValueAtTime(1200, time);
    noiseFilter.frequency.linearRampToValueAtTime(600, time + 1.5);
    noiseFilter.frequency.setValueAtTime(600, time + 1.5);
    noiseFilter.frequency.linearRampToValueAtTime(1800, time + 3.0);
    noiseFilter.frequency.setValueAtTime(1800, time + 3.0);
    noiseFilter.frequency.linearRampToValueAtTime(1000, time + 4.5);

    // FM/AM Chugging - Low-frequency modulator to interrupt the static
    const chugModulator = this.audioCtx.createOscillator();
    const chugGain = this.audioCtx.createGain();
    
    chugModulator.type = "square";
    chugModulator.frequency.setValueAtTime(14, time); // 14 Hz rhythmic modulation
    chugModulator.frequency.setValueAtTime(8, time + 1.5); // slows down
    chugModulator.frequency.setValueAtTime(22, time + 3.0); // speeds up

    chugGain.gain.setValueAtTime(0.4, time);
    chugGain.gain.setValueAtTime(0.15, time + 1.5); // chugging becomes deeper
    chugGain.gain.setValueAtTime(0.5, time + 3.0);

    // Dynamic gain envelope for static screech
    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.7, time + 0.1); // fades in fast
    noiseGain.gain.setValueAtTime(0.7, time + 1.5);
    noiseGain.gain.linearRampToValueAtTime(0.3, time + 2.0); // drops during deep chug
    noiseGain.gain.setValueAtTime(0.3, time + 3.0);
    noiseGain.gain.linearRampToValueAtTime(0.6, time + 3.2); // high pitched scream
    noiseGain.gain.setValueAtTime(0.6, time + 4.2);
    noiseGain.gain.linearRampToValueAtTime(0, time + 4.5); // fades into connection!

    // Connect modulator to control noise filter frequency or gain
    chugModulator.connect(chugGain);
    chugGain.connect(noiseGain.gain); // Modulates the volume directly to create the chugging

    // Connect noise path
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    chugModulator.start(time);
    noiseSource.start(time);
    
    chugModulator.stop(time + 4.5);
    noiseSource.stop(time + 4.5);

    this.activeNodes.push(chugModulator, noiseSource);
    time += 4.5;

    // 7. Connection Chime (High pitched clean confirmation chirp)
    const connectOsc = this.audioCtx.createOscillator();
    const connectGain = this.audioCtx.createGain();
    
    connectOsc.type = "sine";
    connectOsc.frequency.setValueAtTime(1336, time); // classic connection beep
    
    connectGain.gain.setValueAtTime(0, time);
    connectGain.gain.linearRampToValueAtTime(0.5, time + 0.05);
    connectGain.gain.linearRampToValueAtTime(0, time + 0.4); // quick chirp

    connectOsc.connect(connectGain);
    connectGain.connect(this.masterGain);
    
    connectOsc.start(time);
    connectOsc.stop(time + 0.4);
    
    this.activeNodes.push(connectOsc);
    time += 0.4;

    // 8. End of Dial-Up Sound Sequence
    const totalDurationMs = (time - now) * 1000;
    this.timeoutId = setTimeout(() => {
      this.isPlaying = false;
      if (this.stopCallback) {
        this.stopCallback();
        this.stopCallback = null;
      }
    }, totalDurationMs);
  }

  // Play a standard dual-frequency telephone tone
  playDualTone(freq1, freq2, startTime, duration) {
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gainNode1 = this.audioCtx.createGain();
    const gainNode2 = this.audioCtx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    
    osc1.frequency.setValueAtTime(freq1, startTime);
    osc2.frequency.setValueAtTime(freq2, startTime);

    // Smooth gain ramp to avoid pops
    gainNode1.gain.setValueAtTime(0, startTime);
    gainNode1.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
    gainNode1.gain.setValueAtTime(0.4, startTime + duration - 0.01);
    gainNode1.gain.linearRampToValueAtTime(0, startTime + duration);

    gainNode2.gain.setValueAtTime(0, startTime);
    gainNode2.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
    gainNode2.gain.setValueAtTime(0.4, startTime + duration - 0.01);
    gainNode2.gain.linearRampToValueAtTime(0, startTime + duration);

    osc1.connect(gainNode1);
    osc2.connect(gainNode2);
    
    gainNode1.connect(this.masterGain);
    gainNode2.connect(this.masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);

    this.activeNodes.push(osc1, osc2);
  }

  // Stop all active audio elements immediately
  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.activeNodes) {
      this.activeNodes.forEach((node) => {
        try {
          node.stop();
        } catch (e) {
          // Node might have already finished or not started
        }
      });
      this.activeNodes = [];
    }

    // Smoothly ramp master volume to zero
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.audioCtx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);
      } catch (e) {}
    }

    // Close audio context after a short delay
    setTimeout(() => {
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        try {
          this.audioCtx.close().then(() => {
            this.audioCtx = null;
          });
        } catch (e) {}
      }
    }, 150);

    this.isPlaying = false;
    
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = null;
    }
  }
}

// Assign to window for global access across scripts
window.dialupSynth = new DialUpSynthesizer();
window.DialUpSynthesizerClass = DialUpSynthesizer; // expose class reference
