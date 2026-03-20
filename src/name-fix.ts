export function fixGroupNames(groups: any[]) {
  return groups.map(g => {
    if (g.name === "STANDARD" || g.name === "Standard" || g.name === "STANDARD " || !g.name) {
      return { ...g, name: g.children?.[0]?.name || g.name };
    }
    return g;
  });
}
