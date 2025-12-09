/** @param {NS} ns */
export async function main(ns) {
  const myhost = ns.getHostname();
  if(myhost === 'home') {
    return;
  }
  while(true) {
    if(
      ns.getServerSecurityLevel(myhost) >
      ns.getServerMinSecurityLevel(myhost)
    ) {
      await ns.weaken(myhost);
    } else if(
      ns.getServerMoneyAvailable(myhost) <
      ns.getServerMaxMoney(myhost)
    ) {
      await ns.grow(myhost);
    } else {
      await ns.hack(myhost);
    }
  }
}