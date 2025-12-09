// import {
//   assertDivision,
//   getDivisionsForAutocomplete
// } from 'corp/lib.ts';

// const flags: [string, number][] = [
//   ['operations', 0],
//   ['engineer', 0],
//   ['business', 0],
//   ['management', 0],
//   ['research', 0],
//   ['intern', 0],
// ];

// export function autocomplete(
//   data: AutocompleteData,
//   args: string[]
// ): string[] {
//   data.flags(flags);
//   return getDivisionsForAutocomplete();
// }

// export async function main(ns: NS) {
//   const {
//     '_': [division],
//     ...jobs
//   } = ns.flags(flags) as {'_': string[]} & Jobs;
//   assertDivision(ns, division, 'Expected division name');
//   employ(ns, division, jobs);
// }

// type Jobs = {
//   operations?: number,
//   engineer?: number,
//   business?: number,
//   management?: number,
//   research?: number,
//   intern?: number,
// };

// export function employ(
//   ns: NS,
//   division: string,
//   jobs: Jobs,
// ): void {
//   const {
//     getConstants,
//     getDivision,
//     getOffice,
//     hireEmployee,
//     setAutoJobAssignment,
//     upgradeOfficeSize,
//   } = ns.corporation;
//   const total = (
//     (jobs.operations ?? 0)
//     + (jobs.engineer ?? 0)
//     + (jobs.business ?? 0)
//     + (jobs.management ?? 0)
//     + (jobs.research ?? 0)
//     + (jobs.intern ?? 0)
//   );
//   for(const city of getDivision(division).cities) {
//     const diff = total - getOffice(division, city).size;
//     if(diff > 0) {
//       upgradeOfficeSize(division, city, diff);
//     }
//     while(getOffice(division, city).numEmployees < total) {
//       const res = hireEmployee(division, city);
//       if(!res) {
//         throw new Error(`failed to hire ${division} ${city} ${total}`);
//       }
//     }
//     for(const job of getConstants().employeePositions) {
//       setAutoJobAssignment(division, city, job, 0);
//     }
//     const assign = (pos: string, num: number | undefined) => {
//       setAutoJobAssignment(division, city, pos, num ?? 0);
//     };
//     assign("Operations", jobs.operations);
//     assign("Engineer", jobs.engineer);
//     assign("Business", jobs.business);
//     assign("Management", jobs.management);
//     assign("Research & Development", jobs.research);
//     assign("Intern", jobs.intern);
//   }
// }
