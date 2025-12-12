import {
  assertDivision,
  getDivisionsForAutocomplete,
  assertPositive,
} from 'corp/train3/lib.ts';

export function autocomplete(
  data: AutocompleteData,
  args: string[]
): string[] {
  return getDivisionsForAutocomplete();
}

export async function main(ns: NS) {
  const [division, storageSpace] = ns.args;
  assertDivision(ns, division, 'Expected division name');
  assertPositive(ns, storageSpace, 'Expected storage space');
  const {
    nextUpdate,
    getCorporation,
    getDivision,
  } = ns.corporation;
  const discardThresholds: Record<CityName, M2N> = {
    Aevum: {},
    Chongqing: {},
    "Sector-12": {},
    "New Tokyo": {},
    Ishima: {},
    Volhaven: {},
  };
  while(true) {
    await nextUpdate();
    switch(getCorporation().nextState) {
      case 'PURCHASE': {
        for(const city of getDivision(division).cities) {
          const res = purchase(ns, division, city, storageSpace);
          discardThresholds[city] = res.discardThresholds;
        }
        break;
      }
      case 'SALE': {
        for(const city of getDivision(division).cities) {
          discard(ns, division, city, discardThresholds[city]);
        }
        break;
      }
    }
  }
}

type M2N = Partial<Record<CorpMaterialName, number>>;

function purchase(
  ns: NS, division: string, city: CityName, storageSpace: number
): {discardThresholds: M2N} {
  const {
    getWarehouse,
    buyMaterial,
    getConstants,
    getMaterial,
    getMaterialData,
  } = ns.corporation;
  const {
    requiredMaterials,
    producedMaterials,
  } = getMaterialInfo(ns, division);
  for(const mat in requiredMaterials) {
    buyMaterial(division, city, mat, 0);
  }

  const warehouse = getWarehouse(division, city);
  let outputs = 0;
  let other = 0;
  for(const mat of getConstants().materialNames) {
    const {size} = getMaterialData(mat);
    const {stored} = getMaterial(division, city, mat);
    if(producedMaterials.includes(mat)) {
      outputs += size * stored;
    } else if(!requiredMaterials[mat]) {
      other += size * stored;
    }
  }
  const availableSpace = Math.min(
    warehouse.size - other,
    storageSpace
  ) - outputs;
  if(availableSpace < 0.1 * storageSpace) {
    return {discardThresholds: {}};
  }

  const spacePerUnit = Math.max(
    sum(Object.entries(requiredMaterials).map(([m, q]) => (
      q * getMaterialData(m as CorpMaterialName).size
    ))),
    sum(producedMaterials.map(m => getMaterialData(m).size)),
  );
  const wantAmounts = Object.entries(requiredMaterials)
    .map(([m, q]) => 
      [m, q * availableSpace / spacePerUnit] as [CorpMaterialName, number]
    );
  const discardThresholds: M2N = {};
  for(const [mat, want] of wantAmounts) {
    const {stored} = getMaterial(division, city, mat);
    const diff = want - stored;
    if(diff >= 0) {
      buyMaterial(division, city, mat, diff / 10);
    } else {
      discardThresholds[mat] = want;
    }
  }
  return {discardThresholds};
}

function sum(arr: number[]): number {
  let res = 0;
  for(const v of arr) {
    res += v;
  }
  return res;
};

function getMaterialInfo(ns: NS, division: string): {
   requiredMaterials: M2N;
   producedMaterials: CorpMaterialName[];
} {
  const {
    getDivision,
    getIndustryData,
  } = ns.corporation;
  const {
    requiredMaterials,
    producedMaterials,
  } = getIndustryData(getDivision(division).type);
  return {
    requiredMaterials,
    producedMaterials: producedMaterials ?? [],
  };
}

function discard(
  ns: NS,
  division: string,
  city: CityName,
  thresholds: M2N,
) {
  const {
    getMaterial,
    sellMaterial,
    getDivision,
    getIndustryData,
  } = ns.corporation;
  const industry = getIndustryData(getDivision(division).type);
  const requiredMaterials = Object.keys(
    industry.requiredMaterials
  ) as CorpMaterialName[];
  for(const mat of requiredMaterials) {
    const maxStored = thresholds[mat];
    const {stored} = getMaterial(division, city, mat); 
    if(
      typeof maxStored === 'undefined'
      || stored - maxStored <= 0 
    ) {
      sellMaterial(division, city, mat, '0', 'MP');
      continue;
    }
    const discard = stored - maxStored;
    ns.tprint(`Discarded: ${discard} ${mat}`);
    sellMaterial(division, city, mat, ''+discard, '0');
  }
}