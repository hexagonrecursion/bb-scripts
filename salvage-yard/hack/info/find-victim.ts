import {
  autoscan,
  autonuke,
  getServer,
} from 'libv2.ts';

const botGrow = '/mango/grow.js';

export async function main(ns: NS) {
  autonuke(ns);
  const botnetThreads = getBotnetThreads(ns);
  // const level = ns.getHackingLevel();
  const level = 100;
  const servers = autoscan(ns)
    .filter(
      h => 
        getServer(ns, h).requiredHackingSkill <= level
        && getServer(ns, h).hasAdminRights
        && getServer(ns, h).moneyMax > 0
    )
    .sort(
      (a, b) => getServer(ns, a).moneyMax - getServer(ns, b).moneyMax
    );
  for(const s of servers) {
    const {
      hostname,
      moneyMax,
      minDifficulty,
      serverGrowth,
      requiredHackingSkill,
    } = getServer(ns, s);
    /*
    * Estimates how many threads it takes to grow money
    * from 4% (default money in BitNode1) to 100%
    * if we assume the player has no bonuses to growth
    * 
    * Experimentally appears to be between 90% and 110%
    * of the true value
    */
    const growThreadsHeuristic =
      10000 * Math.max(10, minDifficulty) / serverGrowth;
    ns.tprintf('\n');
    ns.tprintf('%s', hostname);
    ns.tprintf('$%s', ns.formatNumber(moneyMax));
    ns.tprintf('grow iterations ~ %f', growThreadsHeuristic / botnetThreads);
    ns.tprintf('minDifficulty: %f', minDifficulty);
    ns.tprintf('requiredHackingSkill: %f', requiredHackingSkill);
  }
}

function getBotnetThreads(ns: NS): number {
  let res = 0;
  for(const server of autoscan(ns)) {
    const {maxRam, hasAdminRights} = getServer(ns, server);
    if(!hasAdminRights) continue;
    res += Math.floor(maxRam / ns.getScriptRam(botGrow));
  }
  return res;
}
