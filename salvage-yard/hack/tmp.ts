
// const botShare = '/mango/share.js';
const botShare = 'weaken-n00dles.ts';
export async function main(ns: NS) {
  const ram = ns.getPurchasedServerMaxRam();
  const perThread = ns.getScriptRam(botShare, 'home');
  const threads = Math.floor(ram/perThread);
  ns.tprint({threads});
  for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
    const name = 'purchassed-' + ('00' + i).slice(-2);
    ns.scp(botShare, name, 'home');
    ns.exec(botShare, name, threads);
  }
}
// import {autoscan, getServer} from 'libv2.ts'

// const botWeaken = '/mango/weaken.js';

// export async function main(ns: NS) {
//   const [maxlvl] = ns.args;
//   const sorted = autoscan(ns)
//     .filter(a => getServer(ns, a).requiredHackingSkill <= maxlvl)
//     .sort((a, b) =>
//       getServer(ns, a).requiredHackingSkill
//       - getServer(ns, b).requiredHackingSkill
//     )
//   for(const victim of sorted) {
//     const {
//       minDifficulty,
//       hackDifficulty,
//       requiredHackingSkill,
//     } = getServer(ns, victim);
//     const wDif = ns.weakenAnalyze(1);
//     const threads = Math.ceil(
//       (hackDifficulty - minDifficulty) / wDif
//     );
//     if(threads <= 0) continue;
//     botExec(ns, {script: botWeaken, threads, args: [0, victim]});
//     ns.tprintf(
//       '%s %d %s',
//       victim,
//       requiredHackingSkill,
//       ns.tFormat(ns.getWeakenTime(victim)),
//     );
//   }
// }

// function botExec(
//   ns: NS,
//   { script, threads, args }: {
//     script: string,
//     threads: number,
//     args: ScriptArg[]
//   }
// ): number {
//   for (const server of autoscan(ns)) {
//     const pid = ns.exec(
//       script,
//       server,
//       { threads, temporary: true },
//       ...args,
//     );
//     if (pid !== 0) {
//       return pid;
//     }
//   }
//   return 0;
// }