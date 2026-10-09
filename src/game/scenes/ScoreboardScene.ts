import Phaser from 'phaser';
import { CONFIG } from '../../config/gameConfig';
import type { ScoreEntry } from '../../utils/scoreboard';
import { applyLayout } from '../layout';
import { fetchScores } from '../leaderboard';
import { UI } from '../palette';
import { Button, drawSky, formatTime, label, panel, title } from '../ui';

const PER_PAGE = 17;
const ROW_H = 46;
const TOP_Y = 270;

interface ScoreboardData {
  from?: string;
  fromData?: object;
  /** Entry id to highlight (the player's own new score). */
  highlightId?: number | null;
  /** Already-fetched list, to skip a second request right after submitting. */
  scores?: ScoreEntry[];
}

export class ScoreboardScene extends Phaser.Scene {
  private data_: ScoreboardData = {};
  private scores: ScoreEntry[] | null = null;
  private page = 0;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private status!: Phaser.GameObjects.Text;
  private pageLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Scoreboard');
  }

  create(data: ScoreboardData): void {
    applyLayout(this, 'center');
    this.data_ = data ?? {};
    this.scores = null;
    this.page = 0;
    this.rows = [];
    drawSky(this);
    const cx = CONFIG.width / 2;

    title(this, cx, 110, 'World Top 51', 64);
    label(this, cx, 180, 'Best scores from players everywhere', 24, '#e8f1ff');
    panel(this, cx, TOP_Y + (PER_PAGE * ROW_H) / 2 - 10, 680, PER_PAGE * ROW_H + 40);
    this.status = label(this, cx, TOP_Y + 300, 'Loading...', 32);

    new Button(this, cx - 250, 1100, '<', () => this.turn(-1), { width: 120, height: 90, fontSize: 44 });
    new Button(this, cx + 250, 1100, '>', () => this.turn(1), { width: 120, height: 90, fontSize: 44 });
    this.pageLabel = label(this, cx, 1095, '', 28);
    new Button(
      this,
      cx,
      1200,
      'Back',
      () => this.scene.start(this.data_.from ?? 'Menu', this.data_.fromData),
      {
        width: 380,
        height: 90,
        color: UI.muted,
        shade: 0x6b6f94,
      },
    );

    if (this.data_.scores) this.show(this.data_.scores);
    else
      void fetchScores().then((s) => {
        if (!this.sys.isActive()) return;
        if (s) this.show(s);
        else this.status.setText("Couldn't load the scoreboard.\nCheck your connection.");
      });
  }

  private show(scores: ScoreEntry[]): void {
    this.scores = scores;
    const i = scores.findIndex((s) => s.id === this.data_.highlightId);
    this.page = i >= 0 ? Math.floor(i / PER_PAGE) : 0;
    this.render();
  }

  private pages(): number {
    return Math.max(1, Math.ceil((this.scores?.length ?? 0) / PER_PAGE));
  }

  private turn(dir: number): void {
    if (!this.scores) return;
    this.page = Phaser.Math.Clamp(this.page + dir, 0, this.pages() - 1);
    this.render();
  }

  private render(): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
    const scores = this.scores ?? [];
    this.status.setVisible(scores.length === 0).setText('No scores yet.\nBe the first!');
    this.pageLabel.setText(scores.length ? `${this.page + 1} / ${this.pages()}` : '');

    const cx = CONFIG.width / 2;
    scores.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((s, j) => {
      const rank = this.page * PER_PAGE + j + 1;
      const y = TOP_Y + j * ROW_H;
      const mine = s.id === this.data_.highlightId;
      if (mine) {
        const g = this.add.graphics();
        g.fillStyle(UI.primary, 0.35);
        g.fillRoundedRect(cx - 330, y - ROW_H / 2 + 2, 660, ROW_H - 4, 12);
        this.rows.push(g);
      }
      const medal = rank === 1 ? '#ffd166' : rank === 2 ? '#e3e7f5' : rank === 3 ? '#f0a868' : '#c9cdf0';
      this.rows.push(
        label(this, cx - 300, y, `${rank}`, 26, medal).setOrigin(0, 0.5),
        // Names are drawn as canvas text (never HTML), so nothing in a name can run as code.
        label(this, cx - 230, y, s.name, 26, mine ? '#ffffff' : '#e8f1ff').setOrigin(0, 0.5),
        label(this, cx + 150, y, formatTime(s.timeSec), 20, '#8f93b8').setOrigin(1, 0.5),
        label(this, cx + 310, y, s.score.toLocaleString('en-US'), 26, '#ffe08a').setOrigin(1, 0.5),
      );
    });
  }
}
