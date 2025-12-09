import {
  assertDivision,
  getDivisionsForAutocomplete,
  assertPositive,
} from 'corp/lib.ts';

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
    getDivision,
    nextUpdate,
    buyMaterial,
    sellMaterial,  
    getMaterial,
  } = ns.corporation;
  const {type, cities} = getDivision(division);
  const boost = optimize(ns, type, storageSpace);
  ns.tprint(boost);
  let isDone = false;
  while(!isDone) {
    await nextUpdate();
    isDone = cities.map(c => {
      return boost.map(([mat, want]) => {
        const {stored} = getMaterial(division, c, mat);
        const buy = (want - stored) / 10;
        if(buy < 0) {
          sellMaterial(division, c, mat, ''+(-buy), 'MP');
          return false;
        }
        sellMaterial(division, c, mat, '0', 'MP');
        if(buy > 0.1) {
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
    for(let i = 0; i < mps.length; ++i) {
      const [mat, pow, sz] = mps[i];
      if(sz === 0) {
        res.push([mat, 0]);
        continue;
      }
      const quantity = (
        totalSize*pow
        -500*sz*(powSum-pow)
        +500*pow*(szSum-sz)
      ) / (sz * powSum);
      if(quantity < 0) {
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

function sum(arr: number[]): number {
  let res = 0;
  for(const v of arr) {
    res += v;
  }
  return res;
};