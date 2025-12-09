/** @param {NS} ns */
export async function main(ns) {
  let victim = ns.args[0];
  while(true) {
    if(
      ns.getServerSecurityLevel(victim) >
      ns.getServerMinSecurityLevel(victim)
    ) {
      await ns.weaken(victim);
      continue;
    }
    if(
      ns.getServerMoneyAvailable(victim) <
      ns.getServerMaxMoney(victim)
    ) {
      await ns.grow(victim);
      continue;
    }
    break;
  }
}