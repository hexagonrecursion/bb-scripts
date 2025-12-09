export async function main(ns: NS) {
  const [server] = ns.args;
  if(typeof server !== 'string') {
    ns.tprintf('Usage:\n%s I.I.I.I', ns.getScriptName());
    return;
  }
  const {
    moneyAvailable,
    moneyMax,
    ...rest
  } = ns.getServer(server);
  for(const k in rest) {
    ns.tprintf('%s: %s', k, (rest as any)[k]);
  }
  ns.tprintf('moneyAvailable: %s', ns.formatNumber(moneyAvailable));
  ns.tprintf('moneyMax: %s', ns.formatNumber(moneyMax));
  ns.tprintf('ns.getHackTime: %s', ns.tFormat(ns.getHackTime(server)));
  ns.tprintf('ns.getWeakenTime: %s', ns.tFormat(ns.getWeakenTime(server)));
  ns.tprintf('ns.getGrowTime: %s', ns.tFormat(ns.getGrowTime(server)));
  ns.tprintf('ns.hackAnalyzeChance: %s', ns.formatPercent(ns.hackAnalyzeChance(server)));
}

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  return [...data.servers];
}