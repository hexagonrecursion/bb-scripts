/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
  let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
  return Array.from(hosts);
}

/** @param {NS} ns */
export async function main(ns) {
  //ns.tprint("From the beginner's guide: As a rule of thumb, your hacking target should be the  with highest max money that's required hacking level is under 1/2 of your hacking level")
  let hack = ns.getHackingLevel();
  let canHack = autoscan(ns)
    .map(ns.getServer)
    .filter(
      s => s.hasAdminRights
      && s.requiredHackingSkill <= hack
    );
  let easyHack = canHack.filter(s =>
    s.requiredHackingSkill < hack / 2
  );
  if (easyHack.length >= 1) {
    canHack = easyHack;
  }
  let max = canHack[0];
  for (let h of canHack) {
    if (h.moneyMax > max.moneyMax) {
      max = h;
    }
  }
  ns.tprint(max);
}