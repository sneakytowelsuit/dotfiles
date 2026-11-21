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
