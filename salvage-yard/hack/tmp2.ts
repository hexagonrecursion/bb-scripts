export async function main(ns: NS) {
  for(const l of ns.infiltration.getPossibleLocations()) {
    const inf = ns.infiltration.getInfiltration(l.name);
    ns.tprint(l.city, l.name, ' ', inf.difficulty, ' ', inf.reward.SoARep);
  }
}