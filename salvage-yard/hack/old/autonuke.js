/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
  let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
  return Array.from(hosts);
}

/** @param {NS} ns */
export async function main(ns) {
  let all = autoscan(ns);
  let root = [];
  for (let h of all) {
    if (h === 'home') continue;
    let openP = 0;
    if (ns.fileExists('BruteSSH.exe', 'home')) {
      ns.brutessh(h);
      openP++;
    }
    if (ns.fileExists('FTPCrack.exe', 'home')) {
      ns.ftpcrack(h);
      openP++;
    }
    if (ns.fileExists('relaySMTP.exe', 'home')) {
      ns.relaysmtp(h);
      openP++;
    }
    if (ns.fileExists('HTTPWorm.exe', 'home')) {
      ns.httpworm(h);
      openP++;
    }
    if (ns.fileExists('SQLInject.exe', 'home')) {
      ns.sqlinject(h);
      openP++;
    }
    let p = ns.getServerNumPortsRequired(h);
    if (p > openP) continue;
    ns.nuke(h);
    root.push(h);
  }
  ns.tprint(`found ${all.length}, nuked ${root.length}`);
  ns.tprint(root);
}