// Copy these definitions into the shared ACTIONS table when integrating the map.
export const MAP_ACTIONS = [
  { id: "map.left", scope: "map", label: "Move map focus left", def: ["left"] },
  { id: "map.right", scope: "map", label: "Move map focus right", def: ["right"] },
  { id: "map.up", scope: "map", label: "Move map focus up", def: ["up"] },
  { id: "map.down", scope: "map", label: "Move map focus down", def: ["down"] },
  { id: "map.go", scope: "map", label: "Go to the focused agent", def: ["enter"] },
  { id: "map.close", scope: "map", label: "Close the agent map", def: ["escape"] },
];
