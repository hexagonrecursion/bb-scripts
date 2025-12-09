import {autoscan, getServer} from 'libv2.ts';
export async function main(ns: NS) {
  const size = [0,0,0,0,0,0];
  for(const server of autoscan(ns)) {
    const {
      maxRam,
      numOpenPortsRequired,
      purchasedByPlayer,
    } = getServer(ns, server);
    if(purchasedByPlayer) {
      continue;
    }
    for(let p = numOpenPortsRequired; p <= 5; ++p) {
      size[p] += maxRam;
    }
  }
  for(let p = 0; p <= 5; ++p) {
    ns.tprintf(
      'openers: %d +%s total: %s',
      p,
      ns.formatRam(size[p] - (size[p-1] ?? 0)),
      ns.formatRam(size[p]),
    );
  }
}