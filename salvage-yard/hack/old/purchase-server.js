/** @param {NS} ns */
export async function main(ns) {
  for(let ram = 1; ram <= ns.getPurchasedServerMaxRam(); ram *= 2) {
    ns.tprint(
      ram,
      ' ',
      ns.formatNumber(ns.getPurchasedServerCost(ram)),
      ' ',
      ns.getPurchasedServerCost(ram) / ram
    );
  }
  if (ns.args.length > 0) {
    let ram = ns.args[0];
    ns.purchaseServer('purchased', +ram);
  }
}