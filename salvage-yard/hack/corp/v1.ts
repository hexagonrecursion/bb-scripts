export async function main(ns: NS) {
  const {
    hireEmployee,
    setAutoJobAssignment,
    nextUpdate,
    getDivision,
    sellMaterial,
  } = ns.corporation;
  const industry = "Agriculture";
  iPurchaseUnlock(ns, 'Smart Supply');
  iExpandIndustry(ns, industry);
  iWantAdVert(ns, industry, 2);
  for (const [, city] of Object.entries(ns.enums.CityName)) {
    iExpandCity(ns, industry, city);
    iPurchaseWarehouse(ns, industry, city);
    iWantOfficeSize(ns, industry, city, 4);
    for(let i = 0; i < 4; ++i) {
      hireEmployee(industry, city);
    }
  }
  while(getDivision(industry).researchPoints < 55) {
    for (const [, city] of Object.entries(ns.enums.CityName)) {
      setAutoJobAssignment(industry, city, 'Research & Development', 4);
    }
    await nextUpdate();
    const {researchPoints} = getDivision(industry);
    ns.tprint(`researchPoints ${researchPoints}`)
  }
  ns.tprint('done research');
  for (const [, city] of Object.entries(ns.enums.CityName)) {
    setAutoJobAssignment(industry, city, 'Research & Development', 0);
    setAutoJobAssignment(industry, city, 'Operations', 1);
    setAutoJobAssignment(industry, city, 'Engineer', 1);
    setAutoJobAssignment(industry, city, 'Business', 1);
    setAutoJobAssignment(industry, city, 'Management', 1);
    sellMaterial(industry, city, 'Food', 'MAX', 'MP');
    sellMaterial(industry, city, 'Plants', 'MAX', 'MP');
  }
}

/// i in the name stands for "idempotent"
function iPurchaseUnlock(ns: NS, upgradeName: string): void {
  if(ns.corporation.hasUnlock(upgradeName)) {
    return;
  }
  ns.corporation.purchaseUnlock(upgradeName);
  // ns.tprint(`purchaseUnlock ${upgradeName}`);
}

function iExpandIndustry(ns: NS, industry: CorpIndustryName) {
  if(ns.corporation.getCorporation().divisions.includes(industry)) {
    return;
  }
  ns.corporation.expandIndustry(industry, industry);
  // ns.tprint('expandIndustry ' + industry);
}

function iExpandCity(ns: NS, division: string, city: CityName) {
  if(ns.corporation.getDivision(division).cities.includes(city)) {
    return;
  }
  ns.corporation.expandCity(division, city);
  // ns.tprint(`expandCity ${division} ${city}`);
}

function iPurchaseWarehouse(ns: NS, division: string, city: CityName) {
  if(ns.corporation.hasWarehouse(division, city)) {
    return;
  }
  ns.corporation.purchaseWarehouse(division, city);
  // ns.tprint(`purchaseWarehouse ${division} ${city}`);
}

function iWantOfficeSize(
  ns: NS,
  division: string,
  city: CityName,
  targetSize: number,
) {
  const {size} = ns.corporation.getOffice(division, city);
  const diff = targetSize - size;
  if(diff <= 0) return;
  ns.corporation.upgradeOfficeSize(division, city, diff);
}

function iWantAdVert(ns: NS, division: string, level: number) {
  while(ns.corporation.getHireAdVertCount(division) < level){
    ns.corporation.hireAdVert(division);
  }
}
