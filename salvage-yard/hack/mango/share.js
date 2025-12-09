/** @param {NS} ns */
export async function main(ns) {
  ns.print(ns.args);
  while(true) {
    await ns.share();
  }
}