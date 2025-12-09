/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
	let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
	return Array.from(hosts);
}

/** @param {NS} ns */
export async function main(ns) {
  for(let h of autoscan(ns)) {
    ns.killall(h, true);
  }
}