// Name entry for the world scoreboard. A real HTML input (not canvas text), so phone keyboards,
// autocorrect and paste all work. Keys typed here never reach the game's own key handlers.

import { NAME_MAX, cleanName } from '../utils/scoreboard';

export interface NameEntryOptions {
  rankHint: string;
  initialName: string;
  /** Called with a valid name; resolve false to keep the box open (e.g. network error). */
  onSave: (name: string) => Promise<boolean>;
  onSkip: () => void;
}

const CSS = `
#ss-name { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  background: rgba(31, 35, 64, 0.6); padding: 16px; font-family: 'Trebuchet MS', system-ui, sans-serif; }
#ss-name .card { width: 100%; max-width: 360px; background: #1f2340; color: #fff; border-radius: 20px;
  padding: 22px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); text-align: center; }
#ss-name h2 { margin: 0 0 4px; font-size: 26px; color: #ffd166; }
#ss-name p { margin: 0 0 6px; font-size: 15px; color: #c9cdf0; }
#ss-name .warn { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #ffb627; }
#ss-name input { width: 100%; box-sizing: border-box; font-family: inherit; font-weight: 700; font-size: 22px; padding: 12px 14px;
  border-radius: 12px; border: 3px solid #5ec2b7; background: #fff; color: #1f2340; outline: none; }
#ss-name .hint { margin: 8px 0 0; font-size: 13px; color: #8f93b8; min-height: 18px; }
#ss-name .hint.error { color: #ff8a8a; }
#ss-name .row { display: flex; gap: 10px; margin-top: 16px; }
#ss-name button { flex: 1; min-height: 52px; border: 0; border-radius: 14px; font-family: inherit; font-weight: 700; font-size: 20px; color: #fff; cursor: pointer; }
#ss-name .save { background: #ffb627; box-shadow: 0 5px 0 #d98c00; }
#ss-name .skip { background: #8f93b8; box-shadow: 0 5px 0 #6b6f94; }
#ss-name button:disabled { opacity: 0.6; }
`;

export class NameEntry {
  private root: HTMLDivElement;

  constructor(opts: NameEntryOptions) {
    if (!document.getElementById('ss-name-css')) {
      const style = document.createElement('style');
      style.id = 'ss-name-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    const root = document.createElement('div');
    root.id = 'ss-name';
    root.innerHTML = `
      <form class="card" autocomplete="off">
        <h2></h2>
        <p>Pick a nickname for the world scoreboard.</p>
        <div class="warn">Don't use your real name.</div>
        <input name="name" maxlength="${NAME_MAX}" placeholder="Nickname" enterkeyhint="done" spellcheck="false" />
        <div class="hint">Letters, numbers and spaces, up to ${NAME_MAX}.</div>
        <div class="row">
          <button type="button" class="skip">Skip</button>
          <button type="submit" class="save">Save</button>
        </div>
      </form>`;
    (root.querySelector('h2') as HTMLElement).textContent = opts.rankHint;
    const form = root.querySelector('form') as HTMLFormElement;
    const input = root.querySelector('input') as HTMLInputElement;
    const hint = root.querySelector('.hint') as HTMLDivElement;
    const save = root.querySelector('.save') as HTMLButtonElement;
    const skip = root.querySelector('.skip') as HTMLButtonElement;
    input.value = opts.initialName;

    // Keep typing (Space, Enter, P, Esc...) away from Phaser's window-level key listeners.
    const stop = (e: Event) => e.stopPropagation();
    root.addEventListener('keydown', stop);
    root.addEventListener('keyup', stop);
    root.addEventListener('pointerdown', stop);

    const setHint = (text: string, error: boolean) => {
      hint.textContent = text;
      hint.classList.toggle('error', error);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = cleanName(input.value);
      if (!name) {
        setHint(`Use 1-${NAME_MAX} letters, numbers or spaces.`, true);
        return;
      }
      save.disabled = skip.disabled = true;
      save.textContent = 'Saving...';
      const ok = await opts.onSave(name);
      if (ok) {
        this.close();
      } else {
        save.disabled = skip.disabled = false;
        save.textContent = 'Try again';
        setHint("Couldn't reach the scoreboard. Check your connection.", true);
      }
    });
    skip.addEventListener('click', () => {
      this.close();
      opts.onSkip();
    });

    document.body.appendChild(root);
    this.root = root;
    window.setTimeout(() => input.focus(), 50);
  }

  close(): void {
    this.root.remove();
  }
}
