export async function main(ns: NS) {
  const player = ns.getPlayer();
  for(const loc in ns.enums.LocationName) {
    ns.tprint(loc);
    const {work} = ns.formulas;
    ns.tprint(work.gymGains(
      player,
      "str",
      ns.enums.LocationName[loc],
    ));
  }
}