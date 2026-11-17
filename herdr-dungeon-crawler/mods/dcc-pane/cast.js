// The cast. An agent is assigned a character from its address, so it keeps the same one.
// Looks come from the DCC wikis (dungeoncrawlercarlwiki.com); colors the wiki doesn't give are my own choices.
import { shared, setShared } from "herdr";

export const CAST = [
  { name: "Carl", color: "#e07a3c", role: "Reluctant crawler",
    snark: "Bold. His record is mostly regret and boxers.",
    say: { working: "Okay. Okay. Moving.", blocked: "I need an answer. Now.", done: "Done. Don't make it weird.", idle: "Sleeping. Leave me alone." } },
  { name: "Princess Donut", color: "#ff6fb8", role: "Queen Bee",
    snark: "Princess Donut approves. Princess Donut approves of anything that is about Princess Donut.",
    say: { working: "Obviously I'm handling this, darling.", blocked: "Carl. CARL. Pay attention to me.", done: "Fabulous. I'm fabulous.", idle: "Grooming. Do not disturb." } },
  { name: "Mordecai", color: "#7ea3dc", role: "Rat Kin guide",
    snark: "He will explain, at length, why this was a mistake.",
    say: { working: "Let me explain how this goes wrong.", blocked: "Kid, I need you to look at this.", done: "Huh. Better than expected.", idle: "Pouring a drink." } },
  { name: "Katia", color: "#a455ff", role: "Doppelganger",
    snark: "Efficient. Quiet. The System is slightly afraid.",
    say: { working: "Moving. Quiet.", blocked: "Waiting on you. Not for long.", done: "Cleared.", idle: "Watching the door." } },
  { name: "Mongo", color: "#4f86e0", role: "Pet raptor",
    snark: "Mongo is a very good raptor. The System has no notes.",
    say: { working: "Mongo run!", blocked: "Mongo wait for you.", done: "Mongo did it!", idle: "Mongo nap." } },
  { name: "Bautista", color: "#e8923a", role: "Tigran",
    snark: "A sensible choice. Do not tell him the System said so.",
    say: { working: "I've got this one.", blocked: "Sorry, I need your help.", done: "All finished. Is everyone okay?", idle: "Taking a breather." } },
  { name: "Zev", color: "#3aa89a", role: "Kua-tin",
    snark: "She will need that in triplicate.",
    say: { working: "Processing. Please hold.", blocked: "I'll need a signature.", done: "Filed. You're welcome.", idle: "Off the clock." } },
  { name: "Elle", color: "#8fc8f0", role: "Frost Maiden",
    snark: "She has opinions about this, and none of them are printable.",
    say: { working: "Oh, you'll regret that.", blocked: "Well? I haven't got all day.", done: "Done. Don't thank me.", idle: "Napping. Touch me and die." } },
  { name: "Quasar", color: "#b0b8c8", role: "Nullian attorney",
    snark: "Billable hours have begun.",
    say: { working: "Objection. Sustained. Billing.", blocked: "I'll need that in writing.", done: "Case closed. Invoice attached.", idle: "Off the record." } },
  { name: "Lucia Mar", color: "#8a6ad8", role: "Lajabless + dogs",
    snark: "Please do not tell the dogs. They will want a say.",
    say: { working: "Cici! Gustavo! Attack!", blocked: "Don't make me ask twice.", done: "Good dogs.", idle: "Resting. The dogs are watching." } },
];


// Pixel-art portrait (24x24 SVG, built by sprites/build.sh from sprites/src/*.txt).
export const sprite = (c) => `mods/dcc-crawlers/sprites/${c.name.replace("Princess ", "").toLowerCase().replace(/ /g, "-")}.svg`;

// Characters picked by hand, kept in shared state under "dcc.cast": { "<agent address>": "<character name>" }.
const picks = () => {
  const m = shared("dcc.cast");
  return m && typeof m === "object" ? m : {};
};

// An agent's character: the one picked for it, else one chosen from a hash of its address.
export function who(key) {
  const picked = CAST.find((c) => c.name === picks()[key]);
  if (picked) return picked;
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CAST[h % CAST.length];
}

export const isCastPicked = (key) => picks()[key] != null;

// Pick a character for an agent (name), or null to go back to the automatic one.
export function setCast(key, name) {
  const m = { ...picks() };
  if (name == null) delete m[key];
  else m[key] = name;
  setShared("dcc.cast", m);
}
