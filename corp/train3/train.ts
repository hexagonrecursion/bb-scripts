type Levels = {
  advert: number,
  smartStorage: number,
  warehouse: number,
  office: number,
  boost: number,
  operations: number,
  engineer: number,
  business: number,
  management: number,
};

export async function main(ns: NS) {
  const {
    createCorporation,
    getCorporation,
  } = ns.corporation;

  let maxScore = 0;
  while (true) {
    ns.killall();
    cheats.deleteCorporation();
    createCorporation('corp', false);
    initIndustry(ns, 'Agriculture');
    cheats.corporationFastForward();

    const weights = {
      advert: Math.random(),
      smartStorage: Math.random(),
      warehouse: Math.random(),
      office: Math.random(),
      boost: Math.random(),
      operations: Math.random(),
      engineer: Math.random(),
      business: Math.random(),
      management: Math.random(),
    };
    const { funds } = getCorporation();
    const teaParty = 1e9;

    const levels = computeLevels(ns, weights, funds - teaParty);
    await apply(ns, levels);
    const score = await getScore(ns);
    if (score > maxScore) {
      maxScore = score;
      ns.tprint(ns.formatNumber(score));
      ns.tprint(levels);
    }
  }
}

function computeLevels(
  ns: NS, weights: Levels, budget: number,
): Levels {
  const mkWeights = () => ({
    advert: 0,
    smartStorage: 0,
    warehouse: 0,
    office: 0,
    boost: 0,
    operations: 0,
    engineer: 0,
    business: 0,
    management: 0,
  });

  const fromLevel: Partial<Levels> = { office: 3, warehouse: 1 };
  const levels = {
    ...mkWeights(),
    boost: weights.boost,
    ...fromLevel,
  };

  {
    const buy = [
      'advert',
      'smartStorage',
      'warehouse',
      'office',
    ] as const;
    const totalWeights = sum(buy.map(k => weights[k]));
    const spent = mkWeights();
    let totalBuyLevels = 0;
    const calcPrice = {
      advert: (fromLevel: number, toLevel: number) => {
        const getAdVertCost = (numAdVerts: number) => {
          // https://github.com/bitburner-official/bitburner-src/blob/d0d776700388a8ed90380bdb806b94a3b0090d94/src/Corporation/Division.ts#L989
          return 1e9 * Math.pow(1.06, numAdVerts);
        }
        let money = 0;
        for (let curLvl = fromLevel; curLvl < toLevel; ++curLvl) {
          money += getAdVertCost(curLvl);
        }
        return money;
      },
      office: (fromLevel: number, toLevel: number) => {
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
        return 6 * calculateOfficeSizeUpgradeCost(fromLevel, toLevel - fromLevel);
      },
      warehouse: (fromLevel: number, toLevel: number) => {
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

        let money = 0;
        for (let curLvl = fromLevel; curLvl < toLevel; ++curLvl) {
          money += calcCost(curLvl);
        }
        return 6 * money;
      },
      smartStorage: (fromLevel: number, toLevel: number) => {
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
        let money = 0;
        for (let curLvl = fromLevel; curLvl < toLevel; ++curLvl) {
          money += calcCost(curLvl);
        }
        return money;
      },
    };
    const addLevel = () => {
      const sorted = buy.toSorted((a, b) => {
        if (totalBuyLevels === 0) {
          return weights[b] - weights[a];
        }
        return (
          (weights[b] / totalWeights - levels[b] / totalBuyLevels)
          - (weights[a] / totalWeights - levels[a] / totalBuyLevels)
        );
      });
      for (const k of sorted) {
        const price = calcPrice[k](fromLevel[k] ?? 0, levels[k] + 1);
        const priceDiff = price - spent[k];
        if (budget >= priceDiff) {
          levels[k] += 1;
          totalBuyLevels += 1;
          spent[k] = price;
          budget -= priceDiff;
          // ns.tprint({
          //   k,
          //   price: ns.formatNumber(price),
          //   priceDiff: ns.formatNumber(priceDiff),
          //   budget: ns.formatNumber(budget),
          // });
          return 'ok';
        }
      }
      return 'out of money';
    }
    // let i = 0;
    // ns.tprint(ns.formatNumber(budget));
    // ns.tprint(levels);
    while (addLevel() === 'ok' /* && i++ < 10 */) {
      // ns.tprint(ns.formatNumber(budget));
      // ns.tprint(levels);
    }
    // ns.tprint(ns.formatNumber(budget));
    // ns.tprint(levels);
  }
  // throw new Error('222');
  {
    const jobNames = [
      'operations', 'engineer', 'business', 'management'
    ] as const;
    const jobTotalWeight = sum(jobNames.map(k => weights[k]));
    const jobsFractional = mkWeights();
    for (const k of jobNames) {
      jobsFractional[k] = weights[k] / jobTotalWeight * levels.office;
      levels[k] = Math.floor(jobsFractional[k]);
    }
    let remainder = levels.office - sum(jobNames.map(k => levels[k]));
    assert(remainder >= 0, 'remainder >= 0');
    assert(remainder <= jobNames.length, 'remainder <= jobNames.length');
    const sorted = jobNames.toSorted((a, b) => (
      (jobsFractional[b] - levels[b])
      - (jobsFractional[a] - levels[a])
    ));
    for (const k of sorted) {
      if (remainder === 0) {
        break;
      }
      remainder -= 1;
      levels[k] += 1;
    }
  }
  return levels
}

async function apply(ns: NS, levels: Levels): Promise<void> {
  const {
    getCorporation,
    getDivision,
    getHireAdVertCost,
    getOffice,
    getOfficeSizeUpgradeCost,
    getUpgradeLevel,
    getUpgradeLevelCost,
    getUpgradeWarehouseCost,
    getWarehouse,
    hireAdVert,
    levelUpgrade,
    nextUpdate,
    sellMaterial,
    upgradeOfficeSize,
    upgradeWarehouse,
  } = ns.corporation;
  const assertFunds = (cost: number, msg: string) => {
    if (cost > getCorporation().funds) {
      throw new Error(msg);
    }
  };
  while (getUpgradeLevel('Smart Storage') < levels.smartStorage) {
    assertFunds(getUpgradeLevelCost('Smart Storage'), 'Smart Storage');
    levelUpgrade('Smart Storage');
  }
  while (getDivision('Agriculture').numAdVerts < levels.advert) {
    assertFunds(getHireAdVertCost('Agriculture'), 'hireAdVert');
    hireAdVert('Agriculture');
  }
  for (const city of getDivision('Agriculture').cities) {
    while (getWarehouse('Agriculture', city).level < levels.warehouse) {
      assertFunds(
        getUpgradeWarehouseCost('Agriculture', city),
        'upgradeWarehouse',
      );
      upgradeWarehouse('Agriculture', city);
    }
    sellMaterial('Agriculture', city, 'Food', 'MAX', 'MP');
    sellMaterial('Agriculture', city, 'Plants', 'MAX', 'MP');
    const diff = levels.office - getOffice('Agriculture', city).size;
    if (diff > 0) {
      assertFunds(
        getOfficeSizeUpgradeCost('Agriculture', city, diff),
        'upgradeOfficeSize',
      );
      upgradeOfficeSize('Agriculture', city, diff);
    }
  }

  employ(ns, 'Agriculture', { management: levels.office });
  let teaParty;
  do {
    await nextUpdate();
    teaParty = buyTeaAndParty(ns);
  } while(teaParty !== 'no-op');

  const researchSeconds = 200;
  employ(ns, 'Agriculture', { research: levels.office });
  for (let t = 0; t < researchSeconds / 10 * 5; ++t) {
    await nextUpdate();
  }
  // stop research
  employ(ns, 'Agriculture', {});

  const warehouseSize = getWarehouse('Agriculture', 'Sector-12').size;
  const boost = Math.floor(warehouseSize * levels.boost);
  const reserved = warehouseSize - boost;
  await buyBoostMaterials(ns, 'Agriculture', boost);

  employ(ns, 'Agriculture', levels);
  ns.run(
    '/corp/train3/dumb-supply.ts',
    undefined,
    'Agriculture',
    reserved
  );
}

async function getScore(ns: NS) {
  const {
    nextUpdate,
    getInvestmentOffer,
  } = ns.corporation;
  const stabilizeSeconds = 200;
  for (let t = 0; t < stabilizeSeconds / 10 * 5; ++t) {
    await nextUpdate();
  }
  return getInvestmentOffer().funds;
}

type Jobs = {
  operations?: number,
  engineer?: number,
  business?: number,
  management?: number,
  research?: number,
  intern?: number,
};

export function employ(
  ns: NS,
  division: string,
  jobs: Jobs,
): void {
  const {
    getConstants,
    getDivision,
    getOffice,
    hireEmployee,
    setAutoJobAssignment,
  } = ns.corporation;
  const jobMap = {
    'Operations': 'operations',
    'Engineer': 'engineer',
    'Business': 'business',
    'Management': 'management',
    'Research & Development': 'research',
    'Intern': 'intern',
  } as const;
  const total = sum(
    Object
      .values(jobMap)
      .map(j => jobs[j] ?? 0)
  );
  for (const city of getDivision(division).cities) {
    while (getOffice(division, city).numEmployees < total) {
      const res = hireEmployee(division, city);
      if (!res) {
        throw new Error(`failed to hire ${division} ${city} ${total}`);
      }
    }
    for (const job of getConstants().employeePositions) {
      setAutoJobAssignment(division, city, job, 0);
    }
    for (const [pos, j] of Object.entries(jobMap)) {
      setAutoJobAssignment(division, city, pos, jobs[j] ?? 0);
    }
  }
}

function sum(arr: number[]): number {
  let res = 0;
  for (const v of arr) {
    res += v;
  }
  return res;
}

function assert(test: boolean, err: string) {
  if (!test) {
    throw new Error('assertion failed: ' + err);
  }
}

declare global {
  var webpackChunkbitburner: any;
  var webpackRequire: any;
}

const cheats = {
  getWebpackRequire(): any {
    // webpackChunkbitburner is a special magical array
    // If you call webpackChunkbitburner.push([[id], {}, func]),
    // it will synchronously call func(__webpack_require__)
    // unless a chink with this `id` already exists
    // See: https://gist.github.com/0xdevalias/8c621c5d09d780b1d321bfdb86d67cdd#reverse-engineering-webpack-apps
    globalThis.webpackChunkbitburner.push([
      [-1 /* unused id */],
      {},
      (webpackRequire: any) => {
        // This will only be called once (unless I generate a
        // unique id each time)
        // Workaround: store webpackRequire globally
        globalThis.webpackRequire = webpackRequire
      }
    ]);
    return globalThis.webpackRequire;
  },
  /* Returns the internal `Player` object used by the game */
  getPlayer(): any {
    const webpackRequire = this.getWebpackRequire();
    // Analysis of the minified js for
    // the version of the game I am playing
    // revealed that the player object is
    // in the module 76191 under the property "ai"
    return webpackRequire(76191).ai;
  },
  deleteCorporation(): void {
    this.getPlayer().corporation = null;
  },
  corporationFastForward(): void {
    this.getPlayer().corporation.storedCycles = 1e20;
  },
};

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
  if (canCreateCorporation(true) === 'Success') {
    createCorporation('corp', true);
  }
  if (canCreateCorporation(false) === 'Success') {
    createCorporation('corp', false);
  }
  const division = industry.replace(/\s/g, "");
  expandIndustry(industry, division);
  const { cities } = getDivision(division);
  for (const city of Object.values(ns.enums.CityName)) {
    if (!cities.includes(city)) {
      expandCity(division, city);
    }
    if (!hasWarehouse(division, city)) {
      purchaseWarehouse(division, city);
    }
  }
}

export async function buyBoostMaterials(
  ns: NS, division: string, storageSpace: number,
): Promise<void> {
  const {
    getDivision,
    nextUpdate,
    buyMaterial,
    sellMaterial,
    getMaterial,
  } = ns.corporation;
  const { type, cities } = getDivision(division);
  const boost = optimize(ns, type, storageSpace);
  // ns.tprint(boost);
  let isDone = false;
  while (!isDone) {
    await nextUpdate();
    isDone = cities.map(c => {
      return boost.map(([mat, want]) => {
        const { stored } = getMaterial(division, c, mat);
        const buy = (want - stored) / 10;
        if (buy < 0) {
          sellMaterial(division, c, mat, '' + (-buy), 'MP');
          return false;
        }
        sellMaterial(division, c, mat, '0', 'MP');
        if (buy > 0.1) {
          buyMaterial(division, c, mat, buy);
          return false;
        }
        buyMaterial(division, c, mat, 0);
        return true;
      }).every(x => x);
    }).every(x => x);
  }
}

// tuple: material, number
type t_mn = [CorpMaterialName, number];
// tuple: material, number, number
type t_mnn = [CorpMaterialName, number, number];

function optimize(
  ns: NS, industry: CorpIndustryName, totalSize: number
): t_mn[] {
  const {
    getIndustryData,
    getMaterialData,
  } = ns.corporation;
  const {
    realEstateFactor,
    hardwareFactor,
    robotFactor,
    aiCoreFactor,
  } = getIndustryData(industry);
  const mp: t_mn[] = [
    ['Real Estate', realEstateFactor ?? 0],
    ['Hardware', hardwareFactor ?? 0],
    ['Robots', robotFactor ?? 0],
    ['AI Cores', aiCoreFactor ?? 0],
  ];
  const mps: t_mnn[] = mp.map(([mat, pow]) => (
    [
      mat,
      pow,
      pow > 0 ? getMaterialData(mat).size : 0,
    ]
  ));
  const rec = (
    mps: t_mnn[]
  ): t_mn[] => {
    const powSum = sum(mps.map(([_, pow, _sz]) => pow));
    const szSum = sum(mps.map(([_, _pow, sz]) => sz));
    const res: t_mn[] = [];
    for (let i = 0; i < mps.length; ++i) {
      const [mat, pow, sz] = mps[i];
      if (sz === 0) {
        res.push([mat, 0]);
        continue;
      }
      const quantity = (
        totalSize * pow
        - 500 * sz * (powSum - pow)
        + 500 * pow * (szSum - sz)
      ) / (sz * powSum);
      if (quantity < 0) {
        return rec(
          mps.filter((_, index) => index !== i)
            .concat([[mat, 0, 0]])
        );
      }
      res.push([mat, quantity]);
    }
    return res;
  };
  return rec(mps);
}

function buyTeaAndParty(ns: NS): 'wrong state' | 'bought' | 'no-op' {
  const {
    getCorporation,
    getDivision,
    buyTea,
    getOffice,
    throwParty,
  } = ns.corporation;
  if (getCorporation().nextState !== 'START') {
    return 'wrong state';
  }
  let res: 'bought' | 'no-op' = 'no-op';
  for (const division of getCorporation().divisions) {
    for (const city of getDivision(division).cities) {
      const {
        avgEnergy,
        maxEnergy,
        avgMorale,
        maxMorale,
      } = getOffice(division, city);
      if (avgEnergy < maxEnergy - 0.5) {
        buyTea(division, city);
        res = 'bought';
      }
      if (maxMorale - avgMorale > 0.5) {
        const bonus = Math.min(
          0.05,  // max 5% growth per party
          (maxMorale - avgMorale) / avgMorale,
        );
        throwParty(division, city, bonus * 10e6);
        res = 'bought';
      }
    }
  }
  return res;
}