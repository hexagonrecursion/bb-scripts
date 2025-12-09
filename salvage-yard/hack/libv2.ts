export function getServer(ns: NS, host: string): Required<Server> {
  let {
    backdoorInstalled,
    baseDifficulty,
    hackDifficulty,
    minDifficulty,
    moneyAvailable,
    moneyMax,
    isConnectedTo,
    numOpenPortsRequired,
    openPortCount,
    requiredHackingSkill,
    serverGrowth,
    ...rest
  } = ns.getServer(host);
  if (
    backdoorInstalled === undefined
    || baseDifficulty === undefined
    || hackDifficulty === undefined
    || minDifficulty === undefined
    || isConnectedTo === undefined
    || moneyAvailable === undefined
    || moneyMax === undefined
    || numOpenPortsRequired === undefined
    || openPortCount === undefined
    || requiredHackingSkill === undefined
    || serverGrowth === undefined
  ) {
    throw host;
  }
  return {
    backdoorInstalled,
    baseDifficulty,
    hackDifficulty,
    minDifficulty,
    isConnectedTo,
    moneyAvailable,
    moneyMax,
    numOpenPortsRequired,
    openPortCount,
    requiredHackingSkill,
    serverGrowth,
    ...rest
  };
}

export function getBotnetRam(ns: NS): {
  ramUsed: number,
  maxRam: number,
} {
  let ramUsed = 0;
  let maxRam = 0;
  for(const server of autoscan(ns)) {
    const s = ns.getServer(server);
    ramUsed += s.ramUsed;
    maxRam += s.maxRam;
  }
  return {ramUsed, maxRam};
}

export function isNeedWeaken(ns: NS, victim: string): boolean {
  let s = getServer(ns, victim);
  return s.hackDifficulty > s.minDifficulty;
}

export function isNeedGrow(ns: NS, victim: string): boolean {
  let s = getServer(ns, victim);
  return s.moneyAvailable < s.moneyMax;
}

export function autoscan(ns: NS): string[] {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
  const hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
  return Array.from(hosts);
}

export function autoKillAtExit(ns: NS) {
  ns.atExit(
    () => {
      for (let h of autoscan(ns)) {
        for (let { pid } of ns.ps(h)) {
          if (ns.getRunningScript(pid)!.parent === ns.pid) {
            ns.kill(pid);
          }
        }
      }
    },
    'autoKillAtExit'
  );
}

export function autonuke(ns: NS) {
  for (const h of autoscan(ns)) {
    try { ns.brutessh(h); } catch (e) { }
    try { ns.ftpcrack(h); } catch (e) { }
    try { ns.relaysmtp(h); } catch (e) { }
    try { ns.httpworm(h); } catch (e) { }
    try { ns.sqlinject(h); } catch (e) { }
    try { ns.nuke(h); } catch (e) { }
  }
}

export function copyHelpers(ns: NS, helpers: string[]) {
  for (const bot of autoscan(ns)) {
    ns.scp(helpers,
      bot,
      'home'
    );
  }
}

export function shortTFormat(ns: NS, milliseconds: number): string {
  if(milliseconds < 1000) {
    return ns.sprintf('%dms', milliseconds);
  }
  const seconds = milliseconds / 1000;
  if(seconds < 60) {
    return ns.sprintf('%.1fs', seconds);
  }
  const minutes = seconds / 60;
  if(minutes < 60) {
    return ns.sprintf('%.1fm', minutes);
  }
  const hours = minutes / 60;
  return ns.sprintf('%.1fh', hours);
}