/** @param {NS} ns */
export async function main(ns) {
  ns.print(ns.args);
  let [sleep, victim, port, marker] = ns.args;
  marker = marker ?? ns.pid;
  await ns.weaken(victim, { additionalMsec: sleep });
  if (port !== undefined) {
    ns.writePort(port, marker);
  }
}