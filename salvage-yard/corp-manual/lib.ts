export function parseIndustryName(
  ns: NS, industry: unknown, err: string
): CorpIndustryName {
  updateAutocomplete(ns);
  const {industryNames} = ns.corporation.getConstants();
  if(typeof industry !== 'string') {
    ns.tprint(err);
    ns.exit();
  };
  const nameMap: {[k in string]?: CorpIndustryName} = {};
  for(const name of industryNames) {
    nameMap[name] = name;
    nameMap[name.replace(/\s/g, "")] = name;
  }
  const res = nameMap[industry]
  if(!res) {
    ns.tprint(err);
    ns.exit();
  };
  return res;
}

export function getIndustryNamesForAutocomplete(): string[] {
  return (
    globalThis
      .corporationConstants
      ?.industryNames
      ?.map(n => n.replace(/\s/g, "")) 
  ) ?? [];
}

export function assertDivision(
  ns: NS, division: unknown, err: string
): asserts division is string {
  updateAutocomplete(ns);
  const corporation = ns.corporation.getCorporation();
  if(
    typeof division !== 'string'
    || !corporation.divisions.includes(division)
  ) {
    ns.tprint(err);
    ns.exit();
  }
}

export function getDivisionsForAutocomplete(): string[] {
  return globalThis.corporationDivisions ?? [];
}

export function assertPositive(
  ns: NS, num: unknown, err: string
): asserts num is number {
  if(typeof num !== 'number' || num <= 0) {
    ns.tprint(err);
    ns.exit();
  }
}

export function updateAutocomplete(ns: NS) {
  const constants = ns.corporation.getConstants();
  globalThis.corporationConstants = constants;
  if(!ns.corporation.hasCorporation()) {
    globalThis.corporationDivisions = [];
    return;
  }
  const {divisions} = ns.corporation.getCorporation();
  globalThis.corporationDivisions = divisions;
}

declare global {
  var corporationConstants: CorpConstants | undefined;
  var corporationDivisions: string[] | undefined;
};