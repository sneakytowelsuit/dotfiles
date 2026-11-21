export function recordRecent(recent, address) {
  const list = Array.isArray(recent) ? recent : [];
  return [...new Set([address, ...list].filter((item) => typeof item === "string" && item))].slice(0, 20);
}

export function previousAddress(recent, live, current) {
  return (Array.isArray(recent) ? recent : []).find((address) => address !== current && live.has(address));
}
