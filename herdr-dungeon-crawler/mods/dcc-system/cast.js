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
  { name: "Mordecai", floor: 1, color: "#7ea3dc", role: "Floor 1 · Rat Hooligan",
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
  { name: "Samantha", color: "#d0b090", role: "Severed head",
    snark: "The System apologizes in advance for her vocabulary.",
    say: { working: "Bite first. Ask later.", blocked: "HEY. HEY. I'm TALKING to you.", done: "Ha! Tell my mother I won.", idle: "Do NOT roll me." } },
  { name: "Louis", color: "#7a9a5a", role: "Army Air General",
    snark: "He will make a joke about this. Probably two.",
    say: { working: "Cloud of Exhaust, baby!", blocked: "Okay, okay, okay, I need a hand here.", done: "Mission accomplished. Anyone got a drink?", idle: "Resting my... lungs." } },
  { name: "Firas", color: "#d0a850", role: "Hammersmith",
    snark: "Reliable. Mostly sober. The System is impressed.",
    say: { working: "Hammer time. Sorry. Hammer time.", blocked: "I'll need a decision, boss.", done: "Done. Quietly.", idle: "Sitting this one out." } },
  // Mordecai's other bodies, one per floor the wiki gives him a form for (floors 1 to 9). Floor 1 is "Mordecai".
  // Picked by hand only: automatic assignment never chooses a variant.
  { name: "Mordecai (Bugaboo)", variant: true, floor: 2, color: "#8a7aa0", role: "Floor 2 · Bugaboo",
    snark: "Fur, fangs and a grudge. Mordecai has seen worse. Mordecai has been worse.",
    say: { working: "I am large and angry and working.", blocked: "Kid. Look at this. Now.", done: "Huh. Nobody died.", idle: "Resting. Do not wake the Bugaboo." } },
  { name: "Mordecai (Incubus)", variant: true, floor: 3, color: "#c04050", role: "Floor 3 · Incubus",
    snark: "Guildmaster chic. The horns are a management decision.",
    say: { working: "Managing. Dramatically.", blocked: "I need a decision from my favorite client.", done: "A flawless performance.", idle: "Off the clock, darling." } },
  { name: "Mordecai (Grulke)", variant: true, floor: 4, color: "#6aa84a", role: "Floor 4 · Grulke Infantry",
    snark: "A toad in armor, managing a cat. Nobody on the Fourth Floor asked questions.",
    say: { working: "Ribbit. I mean, forward!", blocked: "Orders, sir? Ma'am? Kid?", done: "Victory. Croak.", idle: "Sitting in a puddle." } },
  { name: "Mordecai (Pocket Kuma)", variant: true, floor: 6, color: "#b08050", role: "Floor 6 · Pocket Kuma",
    snark: "Fairy-infused and pocket-sized. The System has never seen him this approachable, and it intends to enjoy it.",
    say: { working: "Tiny but furious.", blocked: "Kid, I am pocket-sized and I need you.", done: "Small bear, big result.", idle: "Napping in your pocket." } },
  { name: "Mordecai (Cyclops)", variant: true, floor: 8, color: "#e898b0", role: "Floor 8 · Hills Cyclops",
    snark: "Large, pink and one-eyed. The card game will be taken very seriously.",
    say: { working: "One eye on the problem.", blocked: "I can see you ignoring me. With my one eye.", done: "Pink and proud.", idle: "Eye closed. Mostly." } },
  { name: "Mordecai (Human)", variant: true, floor: 9, color: "#d04040", role: "Floor 9 · Human, eh",
    snark: "The System has presented him as Canadian. The accent was not optional.",
    say: { working: "Sorry, working, eh.", blocked: "Sorry, but I need you to look at this, eh.", done: "Beauty. Done, eh.", idle: "Grabbing a double-double." } },
];


// Pixel-art portrait (24x24 SVG, built by sprites/build.sh from sprites/src/*.txt).
export const sprite = (c) => `mods/dcc-crawlers/sprites/${c.name.replace("Princess ", "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}.svg`;

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
  const pool = CAST.filter((c) => !c.variant); // variants (Mordecai's other bodies) are only ever picked by hand
  return pool[h % pool.length];
}

export const isCastPicked = (key) => picks()[key] != null;

// Pick a character for an agent (name), or null to go back to the automatic one.
export function setCast(key, name) {
  const m = { ...picks() };
  if (name == null) delete m[key];
  else m[key] = name;
  setShared("dcc.cast", m);
}
