import {
  parseIndustryName,
  getIndustryNamesForAutocomplete,
  updateAutocomplete,
} from 'corp/lib.ts';

export function autocomplete(
  data: AutocompleteData,
  args: string[]
): string[] {
  return getIndustryNamesForAutocomplete();
}

export async function main(ns: NS) {
  const industry = parseIndustryName(
    ns, ns.args[0], 'Expected industry name'
  );
  initIndustry(ns, industry);
  updateAutocomplete(ns);
}

export function initIndustry(ns: NS, industry: CorpIndustryName): void {
  const {
    canCreateCorporation,
    createCorporation,
    expandIndustry,
    getDivision,
    expandCity,
    hasWarehouse,
    purchaseWarehouse,
  } = ns.corporation;
  if(canCreateCorporation(true) === 'Success') {
    createCorporation('corp', true);
  }
  if(canCreateCorporation(false) === 'Success') {
    createCorporation('corp', false);
  }
  const division = industry.replace(/\s/g, "");
  expandIndustry(industry, division);
  const {cities} = getDivision(division);
  for(const city of Object.values(ns.enums.CityName)) {
    if(!cities.includes(city)) {
      expandCity(division, city);
    }
    if(!hasWarehouse(division, city)) {
      purchaseWarehouse(division, city);
    }
  }
}

