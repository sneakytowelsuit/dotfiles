const CRITICAL = new Set(["blocked", "error", "stalled"]);

export function groupAgents(list) {
  const byAddress = new Map(list.map((agent) => [agent.address, agent]));
  const groups = new Map();
  const other = { primary: null, agents: [] };

  for (const agent of list) {
    if (agent.primary) groups.set(agent.address, { primary: agent, agents: [agent] });
  }

  for (const agent of list) {
    if (agent.primary) continue;
    let ancestor = byAddress.get(agent.parent);
    const visited = new Set([agent.address]);
    while (ancestor && !ancestor.primary && !visited.has(ancestor.address)) {
      visited.add(ancestor.address);
      ancestor = byAddress.get(ancestor.parent);
    }
    const group = groups.get(ancestor?.address) ?? other;
    group.agents.push(agent);
  }

  return [...groups.values(), other]
    .filter((group) => group.agents.length)
    .map((group) => ({ ...group, critical: group.agents.some((agent) => CRITICAL.has(agent.status)) }))
    .sort((a, b) => Number(b.critical) - Number(a.critical));
}

export function filterGroups(groups, status) {
  if (status == null) return groups;
  return groups
    .map((group) => ({ ...group, agents: group.agents.filter((agent) => agent.status === status) }))
    .filter((group) => group.agents.length);
}

export function cellSize(count) {
  return count > 24 ? 22 : 56;
}

export function gridRows(groups, columns) {
  return groups.flatMap(({ primary, agents }) => {
    const rows = [{ title: primary ? (primary.name || primary.title) : "Other agents" }];
    for (let start = 0; start < agents.length; start += columns) {
      rows.push({ agents: agents.slice(start, start + columns) });
    }
    return rows;
  });
}

export function moveFocus(rows, address, direction) {
  const cellRows = rows.filter((row) => row.agents).map((row) => row.agents);
  const index = cellRows.findIndex((row) => row.some((agent) => agent.address === address));
  if (index < 0) return cellRows[0]?.[0];
  const row = cellRows[index];
  const column = row.findIndex((agent) => agent.address === address);
  if (direction === "left") return row[column - 1] ?? cellRows[index - 1]?.at(-1) ?? row[column];
  if (direction === "right") return row[column + 1] ?? cellRows[index + 1]?.[0] ?? row[column];
  const next = cellRows[index + (direction === "up" ? -1 : 1)];
  return next ? next[Math.min(column, next.length - 1)] : row[column];
}

/**
 * Scale the cells to the space: the largest square size whose grid fits the width and height (cells then fill the width
 * exactly). If even the smallest size does not fit the height, use it and let the grid scroll.
 * `groups`: number of agents in each group; W, H in the same unit as `gap`, `header` (the height of a group title).
 */
export function fitCells(groups, W, H, { min = 22, max = 120, gap = 4, header = 22 } = {}) {
  const total = groups.reduce((a, b) => a + b, 0);
  if (!total || W <= 0) return { size: Math.min(max, 56), columns: 1 };
  let best = null;
  let fallback = null;
  for (let cols = 1; cols <= total; cols++) {
    const size = Math.min(max, Math.floor((W - (cols - 1) * gap) / cols));
    if (size < min) break;
    const rows = groups.reduce((a, n) => a + Math.ceil(n / cols), 0);
    const height = rows * (size + gap) + groups.length * header;
    fallback = { size, columns: cols };
    if (H > 0 && height <= H && (!best || size >= best.size)) best = { size, columns: cols };
  }
  return best ?? fallback ?? { size: min, columns: Math.max(1, Math.floor((W + gap) / (min + gap))) };
}
