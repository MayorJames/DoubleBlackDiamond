// A small developer panel (backtick key) for dialling in the feel without editing code.
// Physics values edit the live run state (and are saved for the next run); client values
// edit this player's settings.

import { DEFAULT_SETTINGS, SETTING_RANGES, type Settings } from '../client/settings';
import { DEFAULT_TUNING, TUNING_RANGES, type Tuning } from '../sim/tuning';

export interface TuningPanelHooks {
  getTuning: () => Tuning;
  onTuningChange: (t: Tuning) => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
}

const decimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step)));

export class TuningPanel {
  private readonly root: HTMLElement;
  private statsBox!: HTMLElement;
  private open = false;

  constructor(private readonly hooks: TuningPanelHooks) {
    const el = document.getElementById('tuning');
    if (!el) throw new Error('#tuning missing');
    this.root = el;
    this.build();
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(force?: boolean): boolean {
    this.open = force ?? !this.open;
    this.root.classList.toggle('hidden', !this.open);
    if (this.open) this.build();
    return this.open;
  }

  setStats(text: string): void {
    if (this.open) this.statsBox.textContent = text;
  }

  private build(): void {
    const root = this.root;
    root.replaceChildren();
    const heading = (text: string) => {
      const h = document.createElement('h3');
      h.textContent = text;
      root.append(h);
    };

    heading('Live stats');
    this.statsBox = document.createElement('div');
    this.statsBox.className = 'stats-box';
    root.append(this.statsBox);

    heading('Player settings');
    const settings = this.hooks.settings;
    const invert = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = settings.invertY;
    box.onchange = () => {
      settings.invertY = box.checked;
      this.hooks.onSettingsChange(settings);
    };
    invert.append(document.createTextNode('invert mouse Y'), box);
    root.append(invert);
    for (const key of Object.keys(SETTING_RANGES) as (keyof typeof SETTING_RANGES)[]) {
      this.slider(key, settings[key], SETTING_RANGES[key], (v) => {
        settings[key] = v;
        this.hooks.onSettingsChange(settings);
      });
    }

    heading('Physics (applies live)');
    const tuning = this.hooks.getTuning();
    for (const key of Object.keys(TUNING_RANGES) as (keyof Tuning)[]) {
      this.slider(key, tuning[key], TUNING_RANGES[key], (v) => {
        const t = this.hooks.getTuning();
        t[key] = v;
        this.hooks.onTuningChange(t);
      });
    }

    const reset = document.createElement('button');
    reset.textContent = 'Reset physics';
    reset.onclick = () => {
      this.hooks.onTuningChange(Object.assign(this.hooks.getTuning(), DEFAULT_TUNING));
      this.build();
    };
    const resetSettings = document.createElement('button');
    resetSettings.textContent = 'Reset settings';
    resetSettings.onclick = () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      this.hooks.onSettingsChange(settings);
      this.build();
    };
    const copy = document.createElement('button');
    copy.textContent = 'Copy physics JSON';
    copy.onclick = () => {
      void navigator.clipboard?.writeText(JSON.stringify(this.hooks.getTuning(), null, 2)).catch(() => undefined);
    };
    root.append(reset, resetSettings, copy);
  }

  private slider(name: string, value: number, [min, max, step]: [number, number, number], onInput: (v: number) => void) {
    const label = document.createElement('label');
    const out = document.createElement('output');
    const dp = decimals(step);
    out.textContent = value.toFixed(dp);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.oninput = () => {
      const v = Number(input.value);
      out.textContent = v.toFixed(dp);
      onInput(v);
    };
    label.append(document.createTextNode(name), out, input);
    this.root.append(label);
  }
}
