const round1Weights = {
  "smartStorage":8,

  "agricultureAdvert":4,
  "agricultureWarehouse":5,
  "agricultureOffice":4,
  
  "agricultureOperations":1,
  "agricultureEngineer":1,
  "agricultureBusiness":1,
  "agricultureManagement":1,
  "agricultureBoost":0.8502961465410834,

  "chemicalWarehouse":0,
  "chemicalOffice":0,
  "chemicalOperations":0,
  "chemicalEngineer":0,
  "chemicalManagement":0,
  "chemicalBoost":0,
};

const round2Weights = {
  "smartStorage":18,
  "agricultureAdvert":15,
  "agricultureWarehouse":13,
  "agricultureOffice":12,
  "chemicalWarehouse":8,
  "chemicalOffice":6,
  "agricultureOperations":4,
  "agricultureEngineer":2,
  "agricultureBusiness":2,
  "agricultureManagement":4,
  "chemicalOperations":1,
  "chemicalEngineer":3,
  "chemicalManagement":2,
  "agricultureBoost":0.761570647126505,
  "chemicalBoost":0.5
};

export async function main(ns: NS) {
  const round = ns.args[0];
  if (round !== 1 && round !== 2) {
    throw new Error('Please select a round to optimize');
  }
  const {
    createCorporation,
    getCorporation,
  } = ns.corporation;

  let best = {1: round1Weights, 2: round2Weights}[round];
  let beseScore = undefined;
  // stochastic hill-climbing optimizer
  while (true) {
    cheats.deleteCorporation();
    createCorporation('corp', false);
    cheats.corporationFastForward();
    await init(ns, round);
    if(round === 2) {
      const experimentalyDeterminedMedianFunds = 319e9;
      cheats.corporationSetFunds(experimentalyDeterminedMedianFunds);
    }
    const { funds } = getCorporation();
    const teaParty = 1e9;

    const weights = (
      beseScore === undefined
      ? best
      : mutateWeights(ns, round, best)
    );
    const levels = computeLevels(ns, round, weights, funds - teaParty);
    {
      const shouldBeSame = computeLevels(ns, round, levels, funds - teaParty);
      for(const [k, v] of Object.entries(levels)) {
        if(v !== shouldBeSame[k as keyof Levels]) {
          ns.tprint('computeLevels() is not idempotent');
          ns.tprint(levels);
          ns.tprint(shouldBeSame);
        }
      }
    }
    const score = await evaluateScore(ns, round, levels);
    ns.print(ns.formatNumber(score));
    ns.print(levels);
    if (beseScore === undefined || score > beseScore) {
      beseScore = score;
      best = levels;
      ns.tprint(ns.formatNumber(score));
      ns.tprint(levels);
    }
  }
}

async function evaluateScore(
  ns: NS, round: 1 | 2, levels: Levels,
): Promise<number> {
  const {getInvestmentOffer} = ns.corporation; 
  await applyLevels(ns, round, levels);
  return getInvestmentOffer().funds;
}

async function applyLevels(
  ns: NS, round: 1 | 2, levels: Levels,
) {
  const {
    nextUpdate,
  } = ns.corporation;
  const agriCities = Object.values(ns.enums.CityName);
  const chemCities = round === 2 ? agriCities : [];

  setUpgrade(ns, 'Smart Storage', levels.smartStorage);
  setAdvert(ns, 'Agriculture', levels.agricultureAdvert);
  setWarehouse(ns, 'Agriculture', agriCities, levels.agricultureWarehouse);
  setOffice(ns, 'Agriculture', agriCities, levels.agricultureOffice);
  setWarehouse(ns, 'Chemical', chemCities, levels.chemicalWarehouse);
  setOffice(ns, 'Chemical', chemCities, levels.chemicalOffice);

  ns.print('tea');
  while (buyTeaAndParty(ns) > 1) {
    await nextUpdate();
  }

  const researchSeconds = 200;
  setJobs(ns, 'Agriculture', agriCities, { research: levels.agricultureOffice });
  setJobs(ns, 'Chemical', chemCities, { research: levels.chemicalOffice });
  ns.print('research');
  for (let t = 0; t < researchSeconds / 10 * 5; ++t) {
    await nextUpdate();
    buyTeaAndParty(ns);
  }
  setJobs(ns, 'Agriculture', agriCities, {});
  setJobs(ns, 'Chemical', chemCities, {});

  ns.print('boost');
  await dumpMaterials(
    ns, 'Agriculture', agriCities, ['Water', 'Chemicals', 'Plants', 'Food'],
  );
  while (
    increaseBoostMaterials(
      ns, 'Agriculture', agriCities, levels.agricultureBoost
    ) !== 'no-op'
    || increaseBoostMaterials(
      ns, 'Chemical', chemCities, levels.chemicalBoost
    ) !== 'no-op'
  ) {
    await nextUpdate();
  }

  setJobs(ns, 'Agriculture', agriCities, {
    operations: levels.agricultureOperations,
    engineer: levels.agricultureEngineer,
    business: levels.agricultureBusiness,
    management: levels.agricultureManagement,
  });
  setJobs(ns, 'Chemical', chemCities, {
    operations: levels.chemicalOperations,
    engineer: levels.chemicalEngineer,
    management: levels.chemicalManagement,
  });
  const stabilizeSeconds = 200;
  ns.print('stabilize');
  setSellMaterial(ns, 'Agriculture', agriCities, 'Food');
  setSellMaterial(ns, 'Agriculture', agriCities, 'Plants');
  setSellMaterial(ns, 'Chemical', chemCities, 'Chemicals');
  setExportMaterial(ns, 'Chemical', 'Agriculture', chemCities, 'Chemicals');
  setExportMaterial(ns, 'Agriculture', 'Chemical', chemCities, 'Plants');
  for (let t = 0; t < stabilizeSeconds / 10 * 5; ++t) {
    if(round === 1) {
      doDumbSupply(ns, 'Agriculture', agriCities);
    }
    await nextUpdate();
  }
}

type Jobs = {
  operations?: number,
  engineer?: number,
  business?: number,
  management?: number,
  research?: number,
  intern?: number,
};

function setJobs(
  ns: NS,
  division: string,
  cities: CityName[],
  jobs: Jobs,
) {
  const {
    getConstants,
    setAutoJobAssignment,
  } = ns.corporation;
  for (const c of cities) {
    for (const job of getConstants().employeePositions) {
      setAutoJobAssignment(division, c, job, 0);
    }
    const assign = (pos: string, workers: number | undefined) => {
      setAutoJobAssignment(division, c, pos, workers ?? 0);
    };
    assign('Operations', jobs.operations);
    assign('Engineer', jobs.engineer);
    assign('Business', jobs.business);
    assign('Management', jobs.management);
    assign('Research & Development', jobs.research);
    assign('Intern', jobs.intern);
  }
}

function setExportMaterial(
  ns: NS,
  sourceDivision: string,
  targetDivision: string,
  cities: CityName[],
  material: string
) {
  const {
    exportMaterial,
  } = ns.corporation;
  for (const c of cities) {
    exportMaterial(
      sourceDivision,
      c,
      targetDivision,
      c,
      material,
      '(IPROD+IINV/10)*(-1)',
    );
  }
}

function setSellMaterial(
  ns: NS, division: string, cities: CityName[], material: string,
) {
  const {
    sellMaterial,
  } = ns.corporation;
  for (const c of cities) {
    sellMaterial(division, c, material, 'MAX', 'MP');
  }
}

function setOffice(
  ns: NS, division: string, cities: CityName[], level: number
) {
  const {
    getOffice,
    upgradeOfficeSize,
    hireEmployee,
  } = ns.corporation;
  for (const c of cities) {
    const diff = level - getOffice(division, c).size;
    if (diff > 0) {
      upgradeOfficeSize(division, c, diff);
    }
    assert(
      getOffice(division, c).size >= level,
      `${division} office >= ${level}`
    );
    for (let l = getOffice(division, c).numEmployees; l < level;) {
      hireEmployee(division, c);
      ++l;
    }
    assert(
      getOffice(division, c).numEmployees >= level,
      `${division} employees >= ${level}`
    );
  }
}

function setWarehouse(
  ns: NS, division: string, cities: CityName[], level: number
) {
  const {
    getWarehouse,
    upgradeWarehouse,
  } = ns.corporation;
  for (const c of cities) {
    for (let l = getWarehouse(division, c).level; l < level;) {
      upgradeWarehouse(division, c);
      ++l;
    }
    assert(
      getWarehouse(division, c).level >= level,
      `${division} warehouse >= ${level}`
    );
  }
}

function setAdvert(ns: NS, division: string, level: number) {
  const {
    getHireAdVertCount,
    hireAdVert,
  } = ns.corporation;
  for (let l = getHireAdVertCount(division); l < level;) {
    hireAdVert(division);
    ++l;
  }
  assert(
    getHireAdVertCount(division) >= level,
    `${division} AdVert >= ${level}`
  );
}

function setUpgrade(ns: NS, name: string, level: number) {
  const {
    getUpgradeLevel,
    levelUpgrade,
  } = ns.corporation;
  for (let l = getUpgradeLevel(name); l < level;) {
    levelUpgrade(name);
    ++l;
  }
  assert(getUpgradeLevel(name) >= level, `${name} >= ${level}`);
}

function setUnlock(ns: NS, name: string) {
  const {
    purchaseUnlock,
    hasUnlock,
  } = ns.corporation;
  if(hasUnlock(name)) return;
  purchaseUnlock(name);
}

/// XXX: may incorrectly handle 3+ input materials
function doDumbSupply(ns: NS, division: string, cities: CityName[]) {
  const {
    getDivision,
    getIndustryData,
    buyMaterial,
    getWarehouse,
    getConstants,
    getMaterialData,
    getMaterial,
  } = ns.corporation;
  const {
    requiredMaterials,
    producedMaterials,
  } = getIndustryData(getDivision(division).type);
  for (const c of cities) {
    for (const mat in requiredMaterials) {
      buyMaterial(division, c, mat, 0);
    }

    let availableSpace = getWarehouse(division, c).size;
    for (const mat of getConstants().materialNames) {
      const { size } = getMaterialData(mat);
      const { stored } = getMaterial(division, c, mat);
      if (!requiredMaterials[mat]) {
        availableSpace -= size * stored;
      }
    }
    if (availableSpace <= 0) {
      continue;
    }
    const spacePerUnit = Math.max(
      sum(Object.entries(requiredMaterials).map(([m, q]) => (
        q * getMaterialData(m as CorpMaterialName).size
      ))),
      sum((producedMaterials ?? []).map(m => getMaterialData(m).size)),
    );
    const wantAmounts = (
      Object.entries(requiredMaterials)
        .map(([m, q]) => (
          [m, q * availableSpace / spacePerUnit] as
          [CorpMaterialName, number]
        ))
    );
    for (const [mat, want] of wantAmounts) {
      const { stored } = getMaterial(division, c, mat);
      const diff = want - stored;
      if (diff >= 0) {
        buyMaterial(division, c, mat, diff / 10);
      }
    }
  }
}

async function dumpMaterials(
  ns: NS, division: string, cities: CityName[], materials: string[],
) {
  const {
    sellMaterial,
    getMaterial,
    nextUpdate,
  } = ns.corporation;
  for (const c of cities) {
    for (const mat of materials) {
      sellMaterial(division, c, mat, 'MAX', '0');
    }
  }
  while (
    cities.some(c =>
      materials.some(mat =>
        getMaterial(division, c, mat).stored > 0
      )
    )
  ) {
    await nextUpdate();
  }
  for (const c of cities) {
    for (const mat of materials) {
      sellMaterial(division, c, mat, '0', 'MP');
    }
  }
}

function increaseBoostMaterials(
  ns: NS, division: string, cities: CityName[], boostFraction: number
): 'buy' | 'no-op' {
  const {
    getDivision,
    getWarehouse,
    buyMaterial,
    getMaterial,
    getMaterialData,
  } = ns.corporation;

  function optimize(
    industry: CorpIndustryName, totalSize: number
  ): [CorpMaterialName, number][] {
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
    const factor = {
      'Real Estate': realEstateFactor ?? 0,
      'Hardware': hardwareFactor ?? 0,
      'Robots': robotFactor ?? 0,
      'AI Cores': aiCoreFactor ?? 0,
    };
    const size = {
      'Real Estate': getMaterialData('Real Estate').size,
      'Hardware': getMaterialData('Hardware').size,
      'Robots': getMaterialData('Robots').size,
      'AI Cores': getMaterialData('AI Cores').size,
    };
    const rec = (
      materials: (keyof typeof factor)[]
    ): [CorpMaterialName, number][] => {
      const powSum = sum(materials.map(mat => factor[mat]));
      const szSum = sum(materials.map(mat => size[mat]));
      const res: [CorpMaterialName, number][] = [];
      for (const mat of materials) {
        const pow = factor[mat];
        const sz = size[mat];
        const quantity = (
          totalSize * pow
          - 500 * sz * (powSum - pow)
          + 500 * pow * (szSum - sz)
        ) / (sz * powSum);
        if (quantity < 0) {
          return rec(materials.filter(elt => elt != mat));
        }
        res.push([mat, quantity]);
      }
      return res;
    };
    return rec(
      (['Real Estate', 'Hardware', 'Robots', 'AI Cores'] as const)
        .filter(mat => factor[mat] > 0)
    );
  }

  const allBoost = [
    'Hardware', 'Robots', 'AI Cores', 'Real Estate'
  ] as const;
  let res: 'buy' | 'no-op' = 'no-op';
  for (const c of cities) {
    let boostUsed = 0;
    for (const mat of allBoost) {
      buyMaterial(division, c, mat, 0);
      const { stored } = getMaterial(division, c, mat);
      const { size } = getMaterialData(mat);
      boostUsed += stored * size;
    }
    const maxBoost = boostFraction * getWarehouse(division, c).size;
    if (boostUsed >= maxBoost * 0.99) {
      continue;
    }
    const boost = optimize(getDivision(division).type, maxBoost);
    for (const [mat, want] of boost) {
      const { stored } = getMaterial(division, c, mat);
      const buy = (want - stored) / 10;
      if (buy > 0) {
        buyMaterial(division, c, mat, buy);
        res = 'buy';
      }
    }
  }
  return res;
}

function buyTeaAndParty(ns: NS): number {
  const {
    getCorporation,
    getDivision,
    buyTea,
    getOffice,
    throwParty,
  } = ns.corporation;
  if (getCorporation().nextState !== 'START') {
    return 100;
  }
  let maxDiff = 0;
  for (const division of getCorporation().divisions) {
    for (const city of getDivision(division).cities) {
      const {
        avgEnergy,
        maxEnergy,
        avgMorale,
        maxMorale,
      } = getOffice(division, city);
      const eDiff = maxEnergy - avgEnergy;
      const mDiff = maxMorale - avgMorale;
      maxDiff = Math.max(maxDiff, eDiff, mDiff);
      if (eDiff > 0.5) {
        const teaOk = buyTea(division, city);
        if(!teaOk) {
          const {funds} = ns.corporation.getCorporation();
          ns.print({division, city, funds});
        }
        assert(teaOk, 'teaOk');
      }
      if (mDiff > 0.5) {
        const bonus = Math.min(
          0.05,  // max 5% growth per party
          mDiff / avgMorale,
        );
        const partyMult = throwParty(division, city, bonus * 10e6);
        assert(partyMult > 0, 'partyMult > 0');
      }
    }
  }
  return maxDiff;
}

function computeLevels(
  ns: NS,
  round: 1 | 2,
  weights: Levels,
  budget: number,
): Levels {
  const {
    getCorporation,
    getUpgradeLevel,
    getHireAdVertCount,
    getWarehouse,
    getOffice,
    getDivision,
  } = ns.corporation;
  const corporation = getCorporation();
  const mkLevels = () => ({
    smartStorage: 0,
    agricultureAdvert: 0,
    agricultureWarehouse: 0,
    agricultureOffice: 0,
    chemicalWarehouse: 0,
    chemicalOffice: 0,
    agricultureOperations: 0,
    agricultureEngineer: 0,
    agricultureBusiness: 0,
    agricultureManagement: 0,
    chemicalOperations: 0,
    chemicalEngineer: 0,
    chemicalManagement: 0,
    agricultureBoost: 0,
    chemicalBoost: 0,
  });
  const stat = (division: string) => {
    let minWarehouse = Infinity;
    let minOffice = Infinity;
    for (const city of getDivision(division).cities) {
      minWarehouse = Math.min(minWarehouse,
        getWarehouse(division, city).level
      );
      minOffice = Math.min(minOffice,
        getOffice(division, city).size
      );
    }
    return { minWarehouse, minOffice };
  };
  const fromLevel = mkLevels();
  fromLevel.smartStorage = getUpgradeLevel('Smart Storage');
  if (corporation.divisions.includes('Agriculture')) {
    fromLevel.agricultureAdvert = getHireAdVertCount('Agriculture');
    const { minWarehouse, minOffice } = stat('Agriculture');
    fromLevel.agricultureWarehouse = minWarehouse;
    fromLevel.agricultureOffice = minOffice;
  }
  if (corporation.divisions.includes('Chemical')) {
    const { minWarehouse, minOffice } = stat('Chemical');
    fromLevel.chemicalWarehouse = minWarehouse;
    fromLevel.chemicalOffice = minOffice;
  }

  const res = {
    ...fromLevel,
    agricultureBoost: weights.agricultureBoost,
  };
  if (round === 2) {
    res.chemicalBoost = weights.chemicalBoost;
  }

  const buy1 = [
    'smartStorage',
    'agricultureAdvert',
    'agricultureWarehouse',
    'agricultureOffice',
  ] as const;
  const buy2 = [
    'chemicalWarehouse',
    'chemicalOffice',
  ] as const;
  const buy = (
    round === 1
      ? buy1
      : [...buy1, ...buy2]
  );
  const totalWeights = sum(buy.map(k => weights[k]));
  const spent = mkLevels();
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
  let totalBuyLevels = sum(Object.values(fromLevel));
  assert(totalBuyLevels > 0, 'totalBuyLevels > 0');
  const addLevel = () => {
    const sorted = buy.toSorted((a, b) => {
      if(totalBuyLevels === 0) {
        return weights[b] - weights[a];
      }
      return (weights[b] / totalWeights - res[b] / totalBuyLevels)
        - (weights[a] / totalWeights - res[a] / totalBuyLevels);
    });
    for (const k of sorted) {
      const priceType = ({
        'smartStorage': 'smartStorage',
        'agricultureAdvert': 'advert',
        'agricultureWarehouse': 'warehouse',
        'agricultureOffice': 'office',
        'chemicalWarehouse': 'warehouse',
        'chemicalOffice': 'office',
      } as const)[k];
      const price = calcPrice[priceType](fromLevel[k] ?? 0, res[k] + 1);
      const priceDiff = price - spent[k];
      if (budget >= priceDiff) {
        res[k] += 1;
        totalBuyLevels += 1;
        spent[k] = price;
        budget -= priceDiff;
        return 'ok';
      }
    }
    return 'out of money';
  }
  while (addLevel() === 'ok') {
  }

  const setJobs = (jobNames: (keyof Levels)[], officeSize: number) => {
    const jobTotalWeight = sum(jobNames.map(k => weights[k]));
    const jobsFractional = mkLevels();
    for (const k of jobNames) {
      jobsFractional[k] = weights[k] / jobTotalWeight * officeSize;
      res[k] = Math.floor(jobsFractional[k]);
    }
    let remainder = officeSize - sum(jobNames.map(k => res[k]));
    assert(
      remainder >= 0,
      `remainder >= 0
      remainder: ${remainder}
      officeSize: ${officeSize}
      jobs: ${jobNames.map(k => res[k])}
      `
    );
    const sorted = jobNames.toSorted((a, b) => (
      (jobsFractional[b] - res[b])
      - (jobsFractional[a] - res[a])
    ));
    for (const k of sorted) {
      if (remainder === 0) {
        break;
      }
      remainder -= 1;
      res[k] += 1;
    }
    assert(remainder === 0, 'remainder === 0');
  }
  setJobs([
    'agricultureOperations',
    'agricultureEngineer',
    'agricultureBusiness',
    'agricultureManagement',
  ], res.agricultureOffice);
  if (round === 2) {
    setJobs([
      'chemicalOperations',
      'chemicalEngineer',
      'chemicalManagement',
    ], res.chemicalOffice);
  }
  return res;
}

function mutateWeights(ns: NS, round: 1 | 2, best: Levels): Levels {
  const res = { ...best };
  const propNames1 = [
    'smartStorage',
    'agricultureAdvert',
    'agricultureWarehouse',
    'agricultureOffice',
    'agricultureOperations',
    'agricultureEngineer',
    'agricultureBusiness',
    'agricultureManagement',
    'agricultureBoost',
  ] as const;
  const propNames2 = [
    'chemicalWarehouse',
    'chemicalOffice',
    'chemicalOperations',
    'chemicalEngineer',
    'chemicalManagement',
    'chemicalBoost',
  ] as const;
  {
    const allProps: string[] = [...propNames1, ...propNames2];
    for (const k of Object.keys(best)) {
      if (!allProps.includes(k)) {
        throw new Error(`Unexpected key ${k}`);
      }
    }
  }
  const mutateProps = (
    round === 1
      ? propNames1
      : [...propNames1, ...propNames2]
  );
  const mutatePos = Math.min(mutateProps.length - 1, Math.floor(
    mutateProps.length * Math.random()
  ));
  const mutateWhat = mutateProps[mutatePos];
  ns.print({mutateWhat});
  if (
    mutateWhat === 'agricultureBoost'
    || mutateWhat === 'chemicalBoost'
  ) {
    res[mutateWhat] = (res[mutateWhat] + Math.random()) / 2;
  } else {
    const previous = Math.max(1, res[mutateWhat]);
    res[mutateWhat] = previous * (Math.random() + Math.random());
  }
  return res;
}

async function init(ns: NS, round: 1 | 2) {
  const {
    expandIndustry,
    expandCity,
    purchaseWarehouse,
    getCorporation,
    acceptInvestmentOffer,
    setSmartSupply,
  } = ns.corporation;

  expandIndustry('Agriculture', 'Agriculture');
  for (const city of Object.values(ns.enums.CityName)) {
    if (city === 'Sector-12') continue;
    expandCity('Agriculture', city);
    purchaseWarehouse('Agriculture', city);
  }
  if (round === 1) {
    return;
  }
  const {funds} = getCorporation();
  const teaParty = 1e9;
  const levels = computeLevels(ns, 1, round1Weights, funds - teaParty);
  await applyLevels(ns, 1, levels);
  const ok = acceptInvestmentOffer();
  assert(ok, 'acceptInvestmentOffer');
  setUnlock(ns, 'Export');
  setUnlock(ns, 'Smart Supply');
  expandIndustry('Chemical', 'Chemical');
  for (const city of Object.values(ns.enums.CityName)) {
    if (city !== 'Sector-12') {
      expandCity('Chemical', city);
      purchaseWarehouse('Chemical', city);
    }
    setSmartSupply('Agriculture', city, true);
    setSmartSupply('Chemical', city, true);
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

export function autocomplete(
  data: AutocompleteData,
  args: string[]
): string[] {
  return ['1', '2'];
}

type Levels = {
  smartStorage: number,

  agricultureAdvert: number,
  agricultureWarehouse: number,
  agricultureOffice: number,
  chemicalWarehouse: number,
  chemicalOffice: number,

  agricultureOperations: number,
  agricultureEngineer: number,
  agricultureBusiness: number,
  agricultureManagement: number,
  chemicalOperations: number,
  chemicalEngineer: number,
  chemicalManagement: number,

  agricultureBoost: number,
  chemicalBoost: number,
};

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
  corporationSetFunds(funds: number): void {
    this.getPlayer().corporation.funds = funds;
  },
};