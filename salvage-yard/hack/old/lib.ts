export default function lib(ns: NS) {
  function getServer(host: string): Required<Server> 
  {
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
    if(
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
  function isNeedWeaken(victim: string): boolean {
    let s = getServer(victim);
    return s.hackDifficulty > s.minDifficulty;
  }
  function isNeedGrow(victim: string): boolean {
    let s = getServer(victim);
    return s.moneyAvailable < s.moneyMax; 
  }
  function autoscan(): string[] {
    // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
    const hosts = new Set(["home"]);
    hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
    return Array.from(hosts);
  }
  function autoKillAtExit() {
    ns.atExit(
      () => {
        for(let h of autoscan()) {
          for(let {pid} of ns.ps(h)) {
            if(ns.getRunningScript(pid)!.parent === ns.pid) {
              ns.kill(pid);
            }
          }
        }
      },
      'autoKillAtExit'
    );
  }
  return {
    getServer,
    autoscan,
    autoKillAtExit,
    isNeedWeaken,
    isNeedGrow,
  }
}