const iterations = 10;
const costAgriculture = 40 * 1e9;
const costCity = 4 * 1e9;
const costWarehouse = 5 * 1e9;
const costTeaParty = 1e9;
const budget = (150 * 1e9
  - costAgriculture
  - 5 * costCity
  - 5 * costWarehouse
  - costTeaParty
);

const secondsPerMarketCycle = 10;

export async function main(ns: NS) {
  let bestLevels = randLevels(budget);
  let bestGoal = calcGoal(bestLevels);
  for (let i = 0; i < iterations; ++i) {
    const levels = randLevels(budget);
    const goal = calcGoal(levels);
    if (goal > bestGoal) {
      bestGoal = goal;
      bestLevels = levels;
    }
  }
  ns.tprint(bestLevels);
}

function calcGoal(levels: Levels): number {
  const corporation = {
    getProductionMultiplier: () => 1 /* SmartFactories */,
    getSalesMult: () => 1 /* ABCSalesBots */,

    getEmployeeCreMultiplier: () => 1 /* NuoptimalNootropicInjectorImplants */,
    getEmployeeChaMult: () => 1 /* SpeechProcessorImplants */,
    getEmployeeIntMult: () => 1 /* NeuralAccelerators */,
    getEmployeeEffMult: () => 1 /* FocusWires */,
  };
  const division = {
    getProductionMultiplier: () => 1 /* research */,
    getSalesMultiplier: () => 1 /* research */,
    
    getEmployeeCreMultiplier: () => 1 /* research */,
    getEmployeeChaMultiplier: () => 1 /* research */,
    getEmployeeIntMultiplier: () => 1 /* research */,
    getEmployeeEffMultiplier: () => 1 /* research */,
    
    productionMult: () => {
      const boost = ...; // TODO
      return boost;
    },
    getOfficeProductivity(
      {operations, engineer, management}: JobProductivity,
      params: { forProduct?: boolean } = {}
    ): number {
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Division.ts#L1005
      const total = operations + engineer + management;

      if (total <= 0) return 0;

      // Management is a multiplier for the production from Operations and Engineers
      const mgmtFactor = 1 + management / (1.2 * total);

      // For production, Operations is slightly more important than engineering
      // Both Engineering and Operations have diminishing returns
      const prod = (Math.pow(operations, 0.4) + Math.pow(engineer, 0.3)) * mgmtFactor;

      // Generic multiplier for the production. Used for game-balancing purposes
      const balancingMult = 0.05;

      if (params && params.forProduct) {
        // Products are harder to create and therefore have less production
        return 0.5 * balancingMult * prod;
      } else {
        return balancingMult * prod;
      }
    },
    maxProd(productivity: JobProductivity) {
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Division.ts#L606
      return (
        this.getOfficeProductivity(productivity) *
        this.productionMult() *
        corporation.getProductionMultiplier() *
        this.getProductionMultiplier()
      );
    }
  };
  const productionVolume = () => {
    const reserved = (
      calcWarehouseSize(levels.warehouse, levels.smartStorage)
      -levels.boost
    );
    const inDensity = /*Water*/ 0.5*0.05 + /*Chemicals*/ 0.2*0.05;
    const outDensity = /*Food*/ 0.03 + /*Plants*/  0.05;
    return Math.min(
      secondsPerMarketCycle * division.maxProd(calcProductivity()),
      reserved / inDensity,
      reserved / outDensity,
    );
  };
  type JobProductivity = {
    operations: number;
    engineer: number;
    business: number;
    management: number;
  };
  const calcProductivity = (): JobProductivity => {
    // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/OfficeSpace.ts#L137
    const avgCreativity = 75 /*average*/;
    const avgCharisma = 75 /*average*/;
    const avgIntelligence = 75 /*average*/;
    const avgEfficiency = 75 /*average*/;
    const avgExp = 75 /*average*/;
    const effCre = (
      avgCreativity
      * corporation.getEmployeeCreMultiplier()
      * division.getEmployeeCreMultiplier()
    ),
    const effCha = (avgCharisma
      * corporation.getEmployeeChaMult()
      * division.getEmployeeChaMultiplier()
    );
    const effInt = (avgIntelligence
      * corporation.getEmployeeIntMult()
      * division.getEmployeeIntMultiplier()
    );
    const effEff = (avgEfficiency
      * corporation.getEmployeeEffMult()
      * division.getEmployeeEffMultiplier()
    );
    return {
      operations: (
        levels.operations *
        (0.6 * effInt + 0.1 * effCha + avgExp + 0.5 * effCre + effEff)
      ),
      engineer: (
        levels.engineer *
        (effInt + 0.1 * effCha + 1.5 * avgExp + effEff)
      ),
      business: (
        levels.business *
        (0.4 * effInt + effCha + 0.5 * avgExp)
      ),
      management: (
        levels.management *
        (2 * effCha + avgExp + 0.2 * effCre + 0.7 * effEff)
      ),
    };
  };
  const calculateEffectWithFactors = (
    n: number, expFac: number, linearFac: number
  ): number => {
    // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/utils/calculateEffectWithFactors.ts
    return Math.pow(n, expFac) + n / linearFac;
  };
  const maxSellPerCycle = (material: 'plants' | 'food') => {
    const qualityAndEffectiveRatingFactor = quality + 0.001;
    const marketFactor = Math.max(0.1, (item.demand * (100 - item.competition)) / 100);
    const markupMultiplier = 1 /* because price === MP */;
    const businessProd = 1 + calcProductivity().business;
    // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Division.ts#L1032
    const businessFactor = calculateEffectWithFactors(businessProd, 0.26, 10e3);
    return (
      qualityAndEffectiveRatingFactor *
      marketFactor *
      markupMultiplier *
      businessFactor *
      corporation.getSalesMult() *
      advertisingFactor *
      division.getSalesMultiplier();
    );
  };
  return Math.min(
    productionVolume(), 
    secondsPerMarketCycle * maxSellPerCycle('plants'),
    secondsPerMarketCycle * maxSellPerCycle('food'),
  );
}

type Levels = {
  ad: number,
  office: number,
  warehouse: number,
  smartStorage: number,

  boost: number,

  operations: number,
  engineer: number,
  business: number,
  management: number,
};

function randLevels(budget: number): Levels {
  const buy = {
    ad: 0,
    office: 3,
    warehouse: 1,
    smartStorage: 0,
  };
  const [a, b, c] = [Math.random(), Math.random(), Math.random()].sort();
  const fracs = [
    ['ad', a],
    ['office', b - a],
    ['warehouse', c - b],
    ['smartStorage', 1 - c]
  ] as const;
  for (const [key, f] of fracs) {
    buy[key] = calcBuy[key](f * budget);
  }

  const warehouseSize = calcWarehouseSize(
    buy.warehouse, buy.smartStorage
  );
  const boost = randInt(0, warehouseSize);
  const [
    operations,
    engineer,
    business,
    management,
  ] = gen4IntsThatAddTo(buy.office);
  const res = {
    ...buy,
    boost,
    operations,
    engineer,
    business,
    management,
  };
  for(const [k, v] of Object.entries(res)) {
    assert(v >= 0, `${k} >= 0`);
    assert(Math.round(v) === v, `${k} is integer`);
  }
  assert(
    operations
    + engineer
    + business
    + management
    === res.office,
    'jobs === office',
  );
  assert(boost <= warehouseSize, 'boost <= warehouseSize');
  return res;
}

const calcBuy = {
  ad: (money: number) => {
    let res = 0;
    const getAdVertCost = (numAdVerts: number) => {
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Division.ts#L989
      return 1e9 * Math.pow(1.06, numAdVerts);
    }
    while (getAdVertCost(res) <= money) {
      money -= getAdVertCost(res);
      ++res;
    }
    return res;
  },
  office: (money: number) => {
    type PositiveInteger = number;
    const corpConstants = {
      officeInitialCost: 4e9,
    };
    function calculateOfficeSizeUpgradeCost(currentSize: number, sizeIncrease: PositiveInteger): number {
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/helpers.ts#L60
      if (sizeIncrease <= 0) throw new Error("Invalid value for sizeIncrease argument! Must be at least 0!");
      const baseCostDivisor = 0.09;
      const baseCostMultiplier = 1 + baseCostDivisor;
      const currentSizeFactor = baseCostMultiplier ** (currentSize / 3);
      const sizeIncreaseFactor = baseCostMultiplier ** (sizeIncrease / 3) - 1;
      return (corpConstants.officeInitialCost / baseCostDivisor) * currentSizeFactor * sizeIncreaseFactor;
    }
    let size = 3;
    while (calculateOfficeSizeUpgradeCost(3, size - 3 + 1) <= money) {
      ++size;
    }
    return size;
  },
  warehouse: (money: number) => {
    const corpConstants = {
      warehouseSizeUpgradeCostBase: 1e9,
    };
    const calcCost = (level: number) => {
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Actions.ts#L437-L442
      return corpConstants.warehouseSizeUpgradeCostBase * Math.pow(
        1.07,
        level + 1
      );
    }
    let res = 1;
    while (calcCost(res) <= money) {
      money -= calcCost(res);
      ++res;
    }
    return res;
  },
  smartStorage: (money: number) => {
    function calcCost(level: number): number {
      const amount = 1;
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/data/CorporationUpgrades.ts#L27
      const upgrade = {
        basePrice: 2e9,
        priceMult: 1.06,
      };
      // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/helpers.ts#L52
      const priceMult = upgrade.priceMult;
      const baseCost = upgrade.basePrice * Math.pow(priceMult, level);
      const cost = (baseCost * (1 - Math.pow(priceMult, amount))) / (1 - priceMult);
      return cost;
    }
    let res = 0;
    while (calcCost(res) <= money) {
      money -= calcCost(res);
      ++res;
    }
    return res;
  },
};

function calcWarehouseSize(
  warehouseLvl: number, smartStorageLvl: number
): number {
  return warehouseLvl * (100 + 10 * smartStorageLvl);
}

function gen4IntsThatAddTo(
  total: number
): [number, number, number, number] {
  assert(total >= 0, 'total >= 0');
  // https://stackoverflow.com/a/3590105
  const [a, b, c] = drawWithoutReplacement(1, total + 3, 3).sort();
  return [a - 1, b - a - 1, c - b - 1, total + 4 - c - 1];
}

function drawWithoutReplacement(
  min: number, max: number, count: number
): number[] {
  assert(min <= max, 'min <= max');
  const length = max - min;
  assert(
    0 <= count && count <= length,
    '0 <= count && count <= length',
  );

  const remap: { [n in number]?: number } = {};
  const drawOneWithoutReplacement = () => {
    const rnd = randInt(min, max);
    const mapped = remap[rnd];
    remap[rnd] = max;
    --max;
    return mapped !== undefined ? mapped : rnd;
  }

  const res = [];
  for (let i = 0; i < count; ++i) {
    res.push(drawOneWithoutReplacement());
  }
  return res;
}

function randInt(min: number, max: number): number {
  assert(min <= max, 'min <= max');
  return min + Math.floor((max - min + 1) * Math.random());
}

function assert(test: boolean, err: string) {
  if (!test) {
    throw new Error('assertion failed: ' + err);
  }
}
