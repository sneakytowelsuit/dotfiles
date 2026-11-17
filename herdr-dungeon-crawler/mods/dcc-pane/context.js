// How full a Claude Code agent's context window is, shown as "crawlers remaining": each token of
// the window is a crawler. Read from the usage numbers Claude Code records in its session transcript
// (~/.claude/projects/<folder>/*.jsonl). Only those numbers are read, never the conversation.
import { exec } from "herdr";

// Context window by model. Current models (Sonnet/Opus/Fable/Haiku 5.x, Opus/Sonnet 4.6+) have 1M;
// Haiku 4.5, Sonnet/Opus 4.5 and older have 200K.
export const windowFor = (model) =>
  /claude-(?:3-|haiku-4|sonnet-4-5|opus-4-5|opus-4-1|(?:sonnet|opus)-4-\d{8})/.test(model ?? "") ? 200000 : 1000000;

// The newest transcript for a folder, and the last few "model" / "usage" fields in it. $1 is the
// folder, spelled the way Claude Code names its project directories (every character that isn't a
// letter or digit becomes "-").
const SCRIPT =
  'f=$(ls -t "$HOME/.claude/projects/$1"/*.jsonl 2>/dev/null | head -n 1); ' +
  '[ -n "$f" ] && tail -c 3000000 "$f" | grep -o \'"model":"[^"]*"\\|"usage":{[^}]*}\' | tail -n 8';

const num = (s, key) => Number(new RegExp(`"${key}":(\\d+)`).exec(s)?.[1] ?? 0);

export const kilo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

// Green while plenty is left, gold below half, red below a fifth.
export const crawlerColor = (frac, t) => (frac > 0.5 ? "#7fd150" : frac > 0.2 ? t.working : t.blocked);

// { used, total, left, frac, model } for the session in `cwd`, or null when it can't be worked out
// (no transcript, nothing readable).
export async function readContext(cwd) {
  if (!cwd) return null;
  try {
    const out = (await exec("sh", ["-c", SCRIPT, "sh", cwd.replace(/[^A-Za-z0-9]/g, "-")], { timeout: 8000 })).stdout.trim().split("\n");
    const usage = [...out].reverse().find((l) => l.startsWith('"usage"'));
    if (!usage) return null;
    const model = [...out].reverse().find((l) => l.startsWith('"model":"claude-'))?.slice(9, -1);
    const used = num(usage, "input_tokens") + num(usage, "cache_creation_input_tokens") + num(usage, "cache_read_input_tokens") + num(usage, "output_tokens");
    const total = windowFor(model);
    const left = Math.max(0, total - used);
    return { used, total, left, frac: left / total, model: model ?? "unknown model" };
  } catch (_e) {
    return null;
  }
}
