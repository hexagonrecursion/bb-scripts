import {
  assertDivision,
  getDivisionsForAutocomplete
} from 'corp/lib.ts';

export function autocomplete(
  data: AutocompleteData,
  args: string[]
): string[] {
  return getDivisionsForAutocomplete();
}

export async function main(ns: NS) {
  const [division] = ns.args;
  const {
    hasUnlock,
    hasWarehouse,
    setSmartSupply,
    sellMaterial,
    getDivision,
    getIndustryData,
  } = ns.corporation;
  assertDivision(ns, division, 'Expected division name');
  const {type} = getDivision(division);
  const {producedMaterials} = getIndustryData(type);
  for(const city of Object.values(ns.enums.CityName)) {
    if(!hasWarehouse(division, city)) {
      continue;
    }
    if(hasUnlock("Smart Supply")) {
      setSmartSupply(division, city, true);
    }
    for(const material of producedMaterials ?? []) {
      sellMaterial(division, city, material, 'MAX', 'MP');
    }
  }
}