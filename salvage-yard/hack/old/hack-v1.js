const victim = 'phantasy'

/** @param {NS} ns */
export async function main(ns) {
  if(ns.self().server === 'home') {
    return;
  }
  while(true) {
    if(
      ns.getServerSecurityLevel(victim) >
      ns.getServerMinSecurityLevel(victim)
    ) {
      await ns.weaken(victim);
    } else if(
      ns.getServerMoneyAvailable(victim) <
      ns.getServerMaxMoney(victim)
    ) {
      await ns.grow(victim);
    } else {
      await ns.hack(victim);
    }
  }
}