import {
  assertDivision,
  getDivisionsForAutocomplete
} from 'corp/lib.ts';

const flags: [string, number][] = [
  ['operations', 0],
  ['engineer', 0],
  ['business', 0],
  ['management', 0],
  ['research', 0],
  ['intern', 0],
];

export function autocomplete(
  data: AutocompleteData,
  args: string[]
): string[] {
  data.flags(flags);
  return getDivisionsForAutocomplete();
}

export async function main(ns: NS) {
  const {
    '_': [division],
    operations,
    engineer,
    business,
    management,
    research,
    intern,
  } = ns.flags(flags) as {
    '_': [] | string[],
    operations: number,
    engineer: number,
    business: number,
    management: number,
    research: number,
    intern: number,
  };
  assertDivision(ns, division, 'Expected division name');
  const {
    getConstants,
    getDivision,
    getOffice,
    hireEmployee,
    setAutoJobAssignment,
  } = ns.corporation;
  const total = operations
    + engineer
    + business
    + management
    + research
    + intern;
  for(const city of getDivision(division).cities) {
    if(getOffice(division, city).size < total) {
      ns.tprint('size < total');
      return;
    }
  }
  const {employeePositions} = getConstants();
  for(const city of getDivision(division).cities) {
    while(getOffice(division, city).numEmployees < total) {
      const result = hireEmployee(division, city);
      if(!result) {
        ns.tprint('unexpected error in hireEmployee()');
        return;
      }
    }
    for(const job of employeePositions) {
      setAutoJobAssignment(division, city, job, 0);
    }
    const rnd = "Research & Development";
    setAutoJobAssignment(division, city, "Operations", operations);
    setAutoJobAssignment(division, city, "Engineer", engineer);
    setAutoJobAssignment(division, city, "Business", business);
    setAutoJobAssignment(division, city, "Management", management);
    setAutoJobAssignment(division, city, rnd, research);
    setAutoJobAssignment(division, city, "Intern", intern);
  }
}