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
  assertDivision(ns, division, 'Expected division name');
  const {
    hasWarehouse,
    getConstants,
    purchaseWarehouse,
    getWarehouse,
    getUpgradeWarehouseCost,
    upgradeWarehouse,
  } = ns.corporation;
  const {
    warehouseInitialCost,
  } = getConstants();
  const wantLvl = ns.args[1];
  if(typeof wantLvl !== 'number') {
    ns.tprint('Expected target warehouse level');
    return;
  }

  let result = allOrNothing(ns, (city) => {
    if(hasWarehouse(division, city)) {
      return {cost: 0};
    }
    return {
      cost: warehouseInitialCost,
      apply: () => {purchaseWarehouse(division, city)},
    };
  });
  if(result !== 'ok') {
    ns.tprint(result);
    return;
  }
  result = allOrNothing(ns, (city) => {
    const {level} = getWarehouse(division, city);
    const lvlDiff = wantLvl - level;
    if(lvlDiff <= 0) return {cost: 0};
    return {
      cost: getUpgradeWarehouseCost(division, city, lvlDiff),
      apply: () => {upgradeWarehouse(division, city, lvlDiff)},
    }
  });
  ns.tprint(result);
}

type Action = {
  cost: number;
  apply?: () => void;
}

function allOrNothing(
  ns: NS,
  f: (city: CityName) => Action,
): 'ok' | 'insufficient funds' {
  const actions = Object.values(ns.enums.CityName).map(f);
  let total = 0;
  for(const {cost} of actions) {
    total += cost;
  }
  if(ns.corporation.getCorporation().funds < total) {
    return 'insufficient funds';
  }
  for(const {apply} of actions) {
    if(apply) apply();
  }
  return 'ok';
}