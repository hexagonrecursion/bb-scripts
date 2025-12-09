/** @param {NS} ns */
export async function main(ns) {
  let sorted = autoscan(ns)
    .map(name => ns.getServer(name))
    .sort((a,b) => (a.moneyMax-b.moneyMax))
    .map(s => s.hostname);
  for(let victim of sorted) {
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
}

/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
	let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
	return Array.from(hosts);
}