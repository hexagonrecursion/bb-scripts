export async function main(ns: NS) {
  const {
    getCorporation,
    getDivision,
    buyTea,
    getOffice,
    nextUpdate,
    throwParty,
  } = ns.corporation;
  while(true) {
    const state = await nextUpdate();
    if (state !== 'START') continue;
    for(const division of getCorporation().divisions) {
      for(const city of getDivision(division).cities) {
        const {
          avgEnergy,
          maxEnergy,
          avgMorale,
          maxMorale,
        } = getOffice(division, city);
        if(avgEnergy < maxEnergy - 0.5) {
          buyTea(division, city);
        }
        if(maxMorale - avgMorale > 0.5) {
          const bonus = Math.min(
            0.05,  // max 5% growth per party
            (maxMorale - avgMorale) / avgMorale,
          );
          throwParty(division, city, bonus*10e6);
        }
      }
    }
  }
}