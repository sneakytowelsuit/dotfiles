// Session readers receive their runtime and metrics helpers from the usage poller.
const FIRST_SCAN_BYTES = 20000000; // a first read looks at no more than the last 20 MB of a transcript

// $1 project folder name, $2 the transcript read last time, $3 how far into it we got. Prints three header lines
// (file, next offset, start offset) then one compact JSON line per assistant response: usage numbers only.
// Reads only the bytes added since last time; stops before an unfinished last line.
const SCRIPT = [
  'command -v jq >/dev/null || exit 3',
  'f=$(ls -t "$HOME/.claude/projects/$1"/*.jsonl 2>/dev/null | head -n 1); [ -n "$f" ] || exit 0',
  'sz=$(wc -c < "$f"); start=0',
  `if [ "$f" = "$2" ] && [ "\${3:-0}" -le "$sz" ]; then start=$3; elif [ "$sz" -gt ${FIRST_SCAN_BYTES} ]; then start=$((sz-${FIRST_SCAN_BYTES})); fi`,
  'next=$sz; if [ -n "$(tail -c 1 "$f")" ]; then p=$(tail -n 1 "$f" | wc -c); next=$((sz-p)); fi',
  'printf "%s\\n%s\\n%s\\n" "$f" "$next" "$start"',
  '[ "$next" -gt "$start" ] || exit 0',
  'head -c "$next" "$f" | tail -c +$((start+1)) | grep -a \'"usage"\' | ' +
    "jq -cR 'fromjson? | select(.type==\"assistant\" and (.message.usage|type)==\"object\" and .isSidechain!=true) | " +
    "{type, timestamp, message:{id:.message.id, model:.message.model, usage:(.message.usage|{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,cache_creation})}}'",
].join("\n");

// A local Codex TUI can have a different cwd from its shell or share a cwd with another
// session. Only use the rollout actually open by its foreground process.
const CODEX_SCRIPT = String.raw`
command -v jq >/dev/null || exit 3
file=
for fd in /proc/"$1"/fd/*; do
  candidate=$(readlink "$fd") || continue
  case "$candidate" in
    /*/sessions/*/rollout-*.jsonl)
      [ -z "$file" ] || [ "$file" = "$candidate" ] || exit 0
      file=$candidate
      ;;
  esac
done
[ -n "$file" ] && [ -f "$file" ] || exit 0
tail -c 2000000 "$file" | jq -cR '
  fromjson? |
  if .type == "turn_context" then
    {model: .payload.model}
  elif .type == "event_msg" and .payload.type == "token_count" and .payload.info != null then
    .timestamp as $t | .payload.info |
    {t: $t, window: .model_context_window, cumulative: .total_token_usage.total_tokens,
      input: .last_token_usage.input_tokens, cached: .last_token_usage.cached_input_tokens,
      output: .last_token_usage.output_tokens}
  else empty end'
`;

async function readCodex({ node, state: s, now, hc, exec, codexMetrics }) {
  s.u = null;
  const result = await hc(["get", node.address, "--json"]);
  if (result.code !== 0) return null;
  const terminal = JSON.parse(result.stdout);
  if (terminal.state !== "live" || terminal.status?.app !== "codex") return null;
  const pid = terminal.foreground?.pid;
  if (!Number.isInteger(pid) || pid < 1) return null;
  const { code, stdout } = await exec("sh", ["-c", CODEX_SCRIPT, "sh", String(pid)], { timeout: 10000 });
  return code === 0 ? codexMetrics(stdout.split("\n"), now) : null;
}

const projectDir = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, "-");

async function readClaude({ node, state: s, now, cwdOf, exec, emptyTotals, parseTurns, addTurn, metrics, keepTurns }) {
  const cwd = cwdOf(node);
  if (!cwd) return null;
  let out;
  try { out = (await exec("sh", ["-c", SCRIPT, "sh", projectDir(cwd), s.file, String(s.offset)], { timeout: 60000 })).stdout; } catch { return s.u; }
  const lines = out.split("\n");
  const [file, next, start] = lines;
  if (!file) return null;
  if (file !== s.file || Number(start) === 0 || Number(start) !== s.offset) {
    // a different session (or a first read, or a rewound file): start over
    s.totals = emptyTotals(); s.turns = []; s.lastRec = null; s.partial = Number(start) > 0;
  }
  s.file = file; s.offset = Number(next) || 0;
  const fresh = parseTurns(lines.slice(3));
  for (const r of fresh) {
    // A response streamed across the read boundary shows up twice: replace the earlier count.
    if (s.lastRec && r.id && r.id === s.lastRec.id) { addTurn(s.totals, s.lastRec, -1); s.turns.pop(); }
    addTurn(s.totals, r); s.turns.push(r); s.lastRec = r;
  }
  if (s.turns.length > keepTurns) s.turns = s.turns.slice(-keepTurns);
  return metrics(s.turns, { totals: s.totals, now, partial: s.partial });
}

export const claudeUsage = {
  supports: { context: true, cacheHits: true, cacheExpiry: true, cost: true },
  read: readClaude,
};

export const codexUsage = {
  supports: { context: true, cacheHits: true, cacheExpiry: false, cost: false },
  read: readCodex,
};

const base = (p) => String(p ?? "").split("/").pop();
/** Is this a Claude Code argv? (the wrapper is sometimes `.claude-wrapped`) */
const isClaude = (argv) => /^\.?claude(-code)?(-wrapped)?$/.test(base(argv?.[0]));
const RESUME = new Set(["--continue", "-c", "--resume", "-r", "--from-pr", "--session-id"]);
export const hasResume = (argv) => (argv ?? []).some((a) => RESUME.has(a) || a.startsWith("--resume=") || a.startsWith("--session-id="));
// Limit Codex recovery to known interactive launches. Replaying an initial prompt or a
// subcommand when resuming can submit new work or change which session is selected.
const CODEX_RESUME_FLAGS = new Set(["--no-alt-screen", "--no-daemon"]);
const isCodex = (argv) => /^\.?codex(-wrapped)?$/.test(base(argv?.[0]));

export const claudeRecovery = {
  matches: isClaude,
  resumeArgs: (argv) => isClaude(argv) && !hasResume(argv) ? ["--continue"] : null,
};

export const codexRecovery = {
  matches: isCodex,
  resumeArgs: (argv) => isCodex(argv) && argv.slice(1).every((arg) => CODEX_RESUME_FLAGS.has(arg))
    ? ["resume", "--last"]
    : null,
};
