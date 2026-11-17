// The floors of the World Dungeon, and which space is on which floor.
// Facts come from the DCC wiki (dungeoncrawlercarlwiki.com); the palettes are my own reading of them.
import { shared, setShared } from "herdr";

export const MAX = 11;

export const FLOORS = [
  { n: 1, name: "First Floor", book: "Dungeon Crawler Carl",
    tag: "Bureaucratic tunnels under Seattle. Warm doors mean refuge; machinery means goblins.",
    arrive: "Floor 1. Welcome to the Dungeon. Warm doors are safe. Most things aren't." },
  { n: 2, name: "Second Floor", book: "Dungeon Crawler Carl",
    tag: "White floors, orange lichen, cinderblock walls. Mind the Taint.",
    arrive: "Floor 2. White floors, orange lichen. Do not urinate on the walls." },
  { n: 3, name: "The Over City", book: "Carl's Doomsday Scenario",
    tag: "Wooden streets under a simulated red sun. A circus. A neon club.",
    arrive: "Floor 3: the Over City. The sun is simulated. The circus is not." },
  { n: 4, name: "Iron Tangle", book: "The Dungeon Anarchist's Cookbook",
    tag: "Numbered stations, colored rail lines, named trains, and a hungry void.",
    arrive: "Floor 4: the Iron Tangle. Please stand clear of the closing doors." },
  { n: 5, name: "The Bubbles", book: "The Gate of the Feral Gods",
    tag: "1,172 enclosed worlds, each in four quadrants: air, land, sea, underground.",
    arrive: "Floor 5: the Bubbles. Sand, sea, storm and one very large gate." },
  { n: 6, name: "The Hunting Grounds", book: "The Butcher's Masquerade",
    tag: "Jungle ruins and a thorned bramble that moves four and a half kilometers an hour.",
    arrive: "Floor 6: the Hunting Grounds. The plants are the hunters." },
  { n: 7, name: "The Great Race", book: "The Butcher's Masquerade",
    tag: "One-way glass tubes, a countdown, and bright portals. Open ten minutes.",
    arrive: "Floor 7: the Great Race. The timer is already running." },
  { n: 8, name: "Ghosts of Earth", book: "The Eye of the Bedlam Bride",
    tag: "An exact copy of Earth before the collapse, haunted by memory ghosts.",
    arrive: "Floor 8: the Ghosts of Earth. Everyone here is already dead. Probably." },
  { n: 9, name: "Faction Wars", book: "This Inevitable Ruin",
    tag: "A war for Larracos: a funnel-shaped city, flooded, muddy and worth killing for.",
    arrive: "Floor 9: Faction Wars. Choose a side. The System will judge." },
  { n: 10, name: "Don't Come in Last", book: "A Parade of Horribles",
    tag: "Seven heats, nine teams each. Your vehicle or mount is also your survival system.",
    arrive: "Floor 10: Don't Come in Last. The last-place containment is failing. Be faster." },
  { n: 11, name: "Parade of Horribles", book: "A Parade of Horribles",
    tag: "Themed floats, audience-voted stand-ins, and an arena with a towering tree.",
    arrive: "Floor 11: the Parade of Horribles. Wear something flamboyant. The audience votes." },
];

export const themeFor = (fl) => `dungeon-f${fl.n}`;

const map = () => {
  const m = shared("dcc.floors");
  return m && typeof m === "object" ? m : {};
};

// A space's floor: the one picked for it, else its place in the list (capped).
export function floorOf(space) {
  const n = map()[space.id] ?? Math.min(Math.max(space.index, 1), MAX);
  return FLOORS[n - 1] ?? FLOORS[0];
}

export function setFloor(spaceId, n) {
  const m = { ...map() };
  if (n == null) delete m[spaceId];
  else m[spaceId] = n;
  setShared("dcc.floors", m);
}

export const isPicked = (space) => map()[space.id] != null;
