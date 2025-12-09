import {autoscan, getServer} from 'libv2.ts';

export async function main(ns: NS) {
  const [script, ...args] = ns.args;
  const pid = ns.run(script as string, 1, ...args);
  const before = ns.getPlayer().money;
  await ns.sleep(1.1 * 60 * 60 * 1000);
  const after = ns.getPlayer().money;
  ns.kill(pid);
  ns.tprint(ns.formatNumber(after - before));
}