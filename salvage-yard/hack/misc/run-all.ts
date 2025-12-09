import {autoscan} from 'libv2.ts';

/** @param {NS} ns */
export async function main(ns) {
  const [script, ...args] = ns.args;
  const sRam = ns.getScriptRam(script);
  for(const h of autoscan(ns)) {
    ns.scp(script, h);
    const freeRam = ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
    const threads = Math.floor(freeRam / sRam);
    if(threads > 0) {
      ns.exec(script, h, threads, ...args);
    }
  }
}