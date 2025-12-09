import {initIndustry} from 'corp/3/init-industry.ts';
import {employ} from 'corp/3/employ.ts';
import {buyBoostMaterials} from 'corp/3/buy-boost-materials.ts';

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

export async function main(ns: NS) {
  const score = await computeScore(ns, {
    boost: 0.7,
    operations: 1,
    engineer: 1,
    business: 1,
    management: 1
  });
  ns.tprint(ns.formatNumber(score));
}

type Weights = {
  boost: number,

  operations: number,
  engineer: number,
  business: number,
  management: number,
};

async function computeScore(ns: NS, weights: Weights): Promise<number> {
  const {
    createCorporation,
    hireAdVert,
    getUpgradeLevel,
    levelUpgrade,
    getDivision,
    getWarehouse,
    upgradeWarehouse,
    nextUpdate,
    getOffice,
    getInvestmentOffer,
    sellMaterial,
  } = ns.corporation;
  ns.killall();
  cheats.deleteCorporation();
  createCorporation('corp', false);
  cheats.corporationFastForward();

  initIndustry(ns, 'Agriculture');

  const levels = {
    advert: 1,
    smartStorage: 3,
    warehouse: 2,
    office: 5,
  };

  const jobs = {
    operations: 0,
    engineer: 0,
    business: 0,
    management: 0,
  };
  {
    const jobTotalWeight = (
      weights.operations
      + weights.engineer
      + weights.business
      + weights.management
    );
    const jobsFractional = {
      operations: 0,
      engineer: 0,
      business: 0,
      management: 0,
    };
    const jobNames = [
      'operations', 'engineer', 'business', 'management'
    ] as const;
    for(const j of jobNames) {
      jobsFractional[j] = weights[j] / jobTotalWeight * levels.office;
      jobs[j] = Math.floor(jobsFractional[j]);
    }
    const sorted = jobNames.toSorted((a,b) =>
       (jobsFractional[b] - jobs[b])
       - (jobsFractional[a] - jobs[a])
    );
    let remainder = levels.office - sum(Object.values(jobs));
    for(const j of sorted) {
      if(remainder === 0) {
        break;
      }
      remainder -= 1;
      jobs[j] += 1;
    }
    assert(
      sum(Object.values(jobs)) === levels.office,
      'jobs === office',
    );
  }

  while(getUpgradeLevel('Smart Storage') < levels.smartStorage) {
    levelUpgrade('Smart Storage');
  }
  while(getDivision('Agriculture').numAdVerts < levels.advert) {
    hireAdVert('Agriculture');
  }
  for(const city of getDivision('Agriculture').cities) {
    while(getWarehouse('Agriculture', city).level < levels.warehouse) {
      upgradeWarehouse('Agriculture', city);
    }
    sellMaterial('Agriculture', city, 'Food', 'MAX', 'MP');
    sellMaterial('Agriculture', city, 'Plants', 'MAX', 'MP');
  }
  // Grow office space to levels.office
  // I could have used `research` instead of `management`,
  // but I worry that this may increase inconsistency between
  // experiments because while(!isMaxEfficiency()) will
  // take a different amount of time in each run => different
  // amount of RP generated 
  employ(ns, 'Agriculture', {management: levels.office});
  ns.run('/corp/tea-party.ts');
  const isMaxEfficiency = () => (
    getDivision('Agriculture').cities.every(city => {
      const {
        avgEnergy,
        maxEnergy,
        avgMorale,
        maxMorale,
      } = getOffice('Agriculture', city);
      return (
        avgEnergy >= maxEnergy - 0.5
        && avgMorale >= maxMorale - 0.5 
      )
    })
  );
  while(!isMaxEfficiency()) {
    await nextUpdate();
  }
  const researchSeconds = 200;
  employ(ns, 'Agriculture', {research: levels.office});
  for(let t = 0; t < researchSeconds / 10 * 5; ++t) {
    await nextUpdate();
  }
  // stop research
  employ(ns, 'Agriculture', {});
  const warehouseSize = getWarehouse('Agriculture', 'Sector-12').size;
  const boost = Math.floor(warehouseSize * weights.boost);
  const reserved = warehouseSize - boost;
  await buyBoostMaterials(ns, 'Agriculture', boost);
  employ(ns, 'Agriculture', jobs);
  ns.run(
    '/corp/dumb-supply.ts',
    undefined,
    'Agriculture',
    reserved
  );
  const stabilizeSeconds = 200;
  for(let t = 0; t < stabilizeSeconds / 10 * 5; ++t) {
    await nextUpdate();
  }
  return getInvestmentOffer().funds;
}

function sum(arr: number[]): number {
  let res = 0;
  for(const v of arr) {
    res += v;
  }
  return res;
}

function assert(test: boolean, err: string) {
  if (!test) {
    throw new Error('assertion failed: ' + err);
  }
}
