enum CostMoney {
  Ad = 'Ad',
  Office = 'Office',
  Warehouse = 'Warehouse',
  SmartStorage = 'SmartStorage',
};
enum CostWarehouse {
  Boost = 'Boost',
  Reserved = 'Reserved',
};
enum CostOffice {
  Operations = 'Operations',
  Engineer = 'Engineer',
  Business = 'Business',
  Management = 'Management',
};
type Resource = CostMoney|CostWarehouse|CostOffice;

export async function main(ns: NS) {
  const [iterations] = ns.args as any;
  const costAgriculture = 40 * 1e9;
  const costCity = 4 * 1e9;
  const costWarehouse = 5 * 1e9;
  const budget = (149 * 1e9
    - costAgriculture
    - 5*costCity
    - 5*costWarehouse
  );

  const initWeights = mkWeights(ns, () => 1);
  let bestLevels = calcLevels(ns, initWeights, budget);
  let bestGoal = calcGoal(ns, bestLevels);
  for(let i = 0; i < iterations; ++i) {
    const weights = mkWeights(ns, () => Math.random());
    const levels = calcLevels(ns, weights, budget);
    const goal = calcGoal(ns, levels);
    if(goal > bestGoal) {
      bestGoal = goal;
      bestLevels = levels;
    }
  }
  ns.tprint(bestLevels);
}

function mkWeights(
  ns: NS,
  init: (r: Resource) => number
): Record<Resource, number> {
  const res = {} as Record<Resource, number>;
  [
    ...Object.values(CostMoney),
    ...Object.values(CostWarehouse),
    ...Object.values(CostOffice),
  ].forEach(r => {
    res[r] = init(r);
  });
  return res;
}

function calcLevels(
  ns: NS, weights: Record<Resource, number>, budget: number
): Record<Resource, number> {
  const total = sum(Object.values(CostMoney).map(res => weights[res]));
  const buy = Object.values(CostMoney).map(res => {
    const maxMoney = Math.floor(
      budget / total * weights[res]
    );
    const [lvl, cost] = calcBuy(ns, res, maxMoney);
    return {res, cost, rest: maxMoney - cost};
  });
  let moneyLeft = sum(buy.map(({rest}) => rest));
  buy.sort(({rest: a}, {rest: b}) => b - a);
  const buy2 = {} as Record<CostMoney, number>;
  buy.forEach(({res, cost, rest}) => {
    const [lvl, newCost] = calcBuy(ns, res, cost + moneyLeft);
    moneyLeft = moneyLeft + cost - newCost;
    buy2[res] = lvl;
  });
  assertIntGtE(ns, buy2, CostMoney.Ad, 0);
  assertIntGtE(ns, buy2, CostMoney.Office, 3);
  assertIntGtE(ns, buy2, CostMoney.SmartStorage, 0);
  assertIntGtE(ns, buy2, CostMoney.Warehouse, 1);

  const warehouseSize = calcWarehouseSize(
    ns, buy2.Warehouse, buy2.SmartStorage
  );
  const reserved = Math.ceil(
    warehouseSize
    / (weights[CostWarehouse.Boost] + weights[CostWarehouse.Reserved])
    * weights[CostWarehouse.Reserved]
  );
  const warehouse = {
    [CostWarehouse.Reserved]: reserved,
    [CostWarehouse.Boost]: warehouseSize - reserved,
  };
  assertIntGtE(ns, warehouse, CostWarehouse.Reserved, 0);
  assertIntGtE(ns, warehouse, CostWarehouse.Boost, 0);
  assertEq(
    ns,
    {warehouseUsed: warehouse.Reserved + warehouse.Boost},
    'warehouseUsed',
    warehouseSize,
  );

  const officeTotal = sum(Object.values(CostOffice).map(r =>
    weights[r]
  ));
  let officeLeft = buy2.Office;
  const sorted = Object.values(CostOffice)
    .sort((a, b) => weights[b] - weights[a]);
  const office = {} as Record<CostOffice, number>;
  for(const job of sorted) {
    office[job] = Math.min(
      officeLeft,
      Math.ceil(buy2.Office / officeTotal * weights[job]),
    );
    officeLeft -= office[job];
  }
  assertIntGtE(ns, office, CostOffice.Business, 0);
  assertIntGtE(ns, office, CostOffice.Engineer, 0);
  assertIntGtE(ns, office, CostOffice.Management, 0);
  assertIntGtE(ns, office, CostOffice.Operations, 0);
  assertEq(
    ns,
    {officeUsed: sum(Object.values(office))},
    'officeUsed',
    buy2.Office,
  );
  return {...buy2, ...warehouse, ...office};
}

function assertIntGtE<T extends string>(
  ns: NS,
  obj: Record<T, number>,
  key: T,
  rhs: number
) {
  if(obj[key] === undefined) {
    throw new Error(`assertIntGtE ${key} is undefined`);  
  }
  if(Math.round(obj[key]) !== obj[key]) {
    throw new Error(`assertIntGtE ${key} is not int ${obj[key]}`);  
  }
  if(obj[key] < rhs) {
    throw new Error(`assertIntGtE failed ${key} ${obj[key]} >= ${rhs}`);
  }
}

function assertEq<T extends string>(
  ns: NS,
  obj: Record<T, number>,
  key: T,
  rhs: number
) {
  if(key in obj && obj[key] === rhs) {
    return;
  }
  throw new Error(`assertion failed ${key} = ${obj[key]} === ${rhs}`);
}

function calcWarehouseSize(
  ns: NS, warehouseLvl: number, smartStorageLvl: number
): number {
  return warehouseLvl * (100 + 10*smartStorageLvl);
}

function calcBuy(
  ns: NS, res: CostMoney, budget: number
): [number, number] {
}

function sum(arr: number[]): number {
  let res = 0;
  for(const v of arr) {
    res += v;
  }
  return res;
};
