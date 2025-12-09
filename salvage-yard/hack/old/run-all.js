/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
	let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
	return Array.from(hosts);
}

/** @param {NS} ns */
export async function main(ns) {
  let [script, ...args] = ns.args;
  let hosts = autoscan(ns);
  for(let h of hosts) {
    ns.scp(script, h);
    let sRam = ns.getScriptRam(script);
    let freeRam = ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
    let threads = Math.floor(freeRam / sRam);
    if(threads > 0) {
      ns.exec(script, h, threads, ...args);
    }
  }
}