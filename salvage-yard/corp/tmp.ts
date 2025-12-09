export async function main(ns: NS) {
  // const {materialNames} = ns.corporation.getConstants();
  // for(const n of materialNames) {
  //   ns.tprint(ns.corporation.getMaterialData(n))
  // }
  // ns.tprint(ns.corporation.getConstants().unlockNames);

  // type RemoveSpaces<T extends string> = T extends `${infer Part1} ${infer Part2}`
  // ? `${Part1}${RemoveSpaces<Part2>}`
  // : T;
  // let x: RemoveSpaces<'foo f qq' | 'bar' | ' first' | 'last    '>;

  // const nameMap: {[k: string]?: CorpIndustryName} = {};
  // const nameMap: {[k in string]?: CorpIndustryName} = {};
  // ns.tprint(ns.corporation.getDivision('Agriculture').numAdVerts);
  // const m = ['Real Estate','Hardware','Robots','AI Cores'];
  // for(const mat of m) {
  //   for(const city of Object.values(ns.enums.CityName)) {
  //     ns.corporation.buyMaterial('Agriculture', city, mat, 0);
  //     // ns.corporation.sellMaterial('Agriculture', city, mat, 'MAX', '0');
  //     ns.corporation.sellMaterial('Agriculture', city, mat, '0', '0');
  //   }
  // }

  const a = new Foo();
  const b = new Foo();
  ns.tprint(a.x.pop());
  ns.tprint(a.x.pop());
  ns.tprint(b.x.pop());
  ns.tprint(a.x.pop());
  ns.tprint(b.x.pop());
  ns.tprint(b.x.pop());
}

class Foo {
  x = [1,2,3]
}