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
  const {
    canCreateCorporation,
    createCorporation,
    expandIndustry,
    getDivision,
    expandCity,
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
    if(cities.includes(city)) continue;
    expandCity(division, city);
  }
  updateAutocomplete(ns);
}

