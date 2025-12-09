import {
  autoKillAtExit,
  autonuke,
  autoscan,
  copyHelpers,
  isNeedGrow,
  isNeedWeaken,
  getServer,
} from 'libv2.ts';

// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const maxHackFrac = 0.5;
const slotMs = 200;

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  data.flags([['purchase-servers', false]]);
  return [...data.servers];
}

export async function main(ns: NS) {
  const flags = ns.flags([['purchase-servers', false]]);
  const isPurchaseServers = !!flags['purchase-servers'];
  const [victim] = flags['_'] as string[];
  if (typeof victim !== 'string') {
    ns.tprintf(
      'Usage:\n' +
      '%1$s n00dles\n' +
      '%1$s n00dles --purchase-servers',
      ns.getScriptName(),
    );
    return;
  }
  ns.disableLog('ALL');
  autoKillAtExit(ns);
  while (true) {
    autonuke(ns);
    if (isPurchaseServers) {
      purchaseServers(ns);
    }
    copyHelpers(ns, [botWeaken, botGrow, botHack]);
    if (isNeedWeaken(ns, victim)) {
      await prepWeaken(ns, victim);
      continue;
    }
    if (isNeedGrow(ns, victim)) {
      await prepGrow(ns, victim);
      continue;
    }
    await execHack(ns, victim);
  }
}

function purchaseServers(ns: NS) {
  for (let i = 0; i < ns.getPurchasedServerLimit(); ++i) {
    const name = 'purchassed-' + ('00' + i).slice(-2);
    if (!ns.serverExists(name)) {
      if (!ns.purchaseServer(name, 1)) {
        continue;
      }
    }
    for (let r = 1; r <= ns.getPurchasedServerMaxRam(); r *= 2) {
      ns.upgradePurchasedServer(name, r);
    }
  }
}

async function prepGrow(ns: NS, victim: string) {
  if (ns.getScriptRam(botWeaken) !== ns.getScriptRam(botGrow)) {
    throw 'we assume weaken and grow cost the same';
  }
  let threads = 0;
  for (const bot of autoscan(ns)) {
    threads += getMaxThreads(ns, { bot, script: botWeaken });
  }
  const gs = ns.growthAnalyzeSecurity(1);
  const ws = ns.weakenAnalyze(1);
  let wThreads = Math.ceil(threads * gs / (gs + ws));
  let gThreads = threads - wThreads;
  const end = Math.max(
    ns.getGrowTime(victim) + slotMs,
    ns.getWeakenTime(victim),
  )
  for (const bot of autoscan(ns)) {
    const maxT = getMaxThreads(ns, { bot, script: botGrow });
    const threads = Math.min(maxT, gThreads);
    if (threads === 0) {
      continue;
    }
    gThreads -= threads;
    ns.exec(
      botGrow,
      bot,
      { temporary: true, threads },
      end - (ns.getGrowTime(victim) + slotMs),
      victim,
    );
  }
  for (const bot of autoscan(ns)) {
    const maxT = getMaxThreads(ns, { bot, script: botWeaken });
    const threads = Math.min(maxT, wThreads);
    if (threads === 0) {
      continue;
    }
    wThreads -= threads;
    ns.exec(
      botWeaken,
      bot,
      { temporary: true, threads },
      end - ns.getWeakenTime(victim),
      victim,
    );
  }
  if (wThreads !== 0 || gThreads !== 0) {
    throw `wThreads=${wThreads} gThreads=${gThreads}`;
  }
  const sleep = end + slotMs;
  const { moneyMax, moneyAvailable } = getServer(ns, victim);
  ns.printf(
    'grow %s %s',
    ns.tFormat(sleep),
    ns.formatPercent(moneyAvailable / moneyMax),
  );
  await ns.sleep(sleep);
}

async function prepWeaken(ns: NS, victim: string) {
  const { minDifficulty, hackDifficulty } = getServer(ns, victim);
  execW(ns, 0, victim, hackDifficulty - minDifficulty);
  const sleep = ns.getWeakenTime(victim) + slotMs;
  ns.printf(
    'weaken %s %s',
    ns.tFormat(sleep),
    ns.formatPercent(hackDifficulty / minDifficulty),
  );
  await ns.sleep(sleep);
}

async function execHack(ns: NS, victim: string) {
  let waves = 0;
  execFull: while (true) {
    await ns.sleep(0);
    for (let i = 0; i < 10; ++i) {
      const result = execBatch(ns, {
        victim,
        // H.W.G.W .H.W.G.W
        start: waves * 4 * slotMs,
        hackFrac: maxHackFrac
      });
      if (result === 'out of memory') {
        break execFull;
      }
      ++waves;
    }
  }
  if (waves) {
    ns.print('waves: ', waves);
  }
  if (waves <= 2) {
    for(let i = 200; i >= 0; --i) {
      const hackFrac = maxHackFrac * i / 200;
      const result = execBatch(ns, { victim, start: 0, hackFrac });
      if (result === 'ok') {
        ns.print('hackFrac: ', ns.formatPercent(hackFrac));
        break;
      }
      if(i % 10 === 0) {
        await ns.sleep(0);
      }
    }
  }
  const sleep = bathEnd(ns, victim, waves * 4 * slotMs) + slotMs
  ns.print('hack ', ns.tFormat(sleep));
  await ns.sleep(sleep);
}

function bathEnd(ns: NS, victim: string, start: number): number {
  return start + Math.max(
    ns.getHackTime(victim) + 3 * slotMs,
    ns.getWeakenTime(victim) + 2 * slotMs,
    ns.getGrowTime(victim) + slotMs,
    ns.getWeakenTime(victim),
  );
}

function execBatch(
  ns: NS,
  { victim, start, hackFrac }: {
    victim: string;
    start: number;
    hackFrac: number;
  }
): 'ok' | 'out of memory' {
  const end = bathEnd(ns, victim, start);
  const hSleep = end - 3 * slotMs - ns.getHackTime(victim);
  const w1Sleep = end - 2 * slotMs - ns.getWeakenTime(victim);
  const gSleep = end - slotMs - ns.getGrowTime(victim);
  const w2Sleep = end - ns.getWeakenTime(victim);
  const {
    success: hSuccess,
    pid: hPid,
    security: hSecurity,
  } = execH(ns, hSleep, victim, hackFrac);
  const {
    success: w1Success,
    pid: w1Pid,
  } = execW(ns, w1Sleep, victim, hSecurity);
  const {
    success: gSuccess,
    pid: gPid,
    security: gSecurity,
  } = execG(ns, gSleep, victim, hackFrac);
  const {
    success: w2Success,
    pid: w2Pid,
  } = execW(ns, w2Sleep, victim, gSecurity);
  if (hSuccess && w1Success && gSuccess && w2Success) {
    return 'ok';
  }
  [...hPid, ...w1Pid, ...gPid, ...w2Pid]
    .forEach(p => ns.kill(p));
  return 'out of memory';
}

function execH(
  ns: NS,
  sleep: number,
  victim: string,
  hackFrac: number,
): {
  success: boolean,
  pid: number[],
  security: number,
} {
  const hackAnalyze = ns.hackAnalyze(victim);
  const script = botHack;
  let fracRemain = 1;
  let security = 0;
  const pid: number[] = [];
  for (const bot of autoscan(ns)) {
    const maxT = getMaxThreads(ns, { bot, script });
    if (maxT === 0) {
      continue;
    }
    const wantT = Math.max(0, Math.floor(
      (1 - (1 - hackFrac) / fracRemain) / hackAnalyze
    ));
    if (wantT === 0) return { success: true, security, pid };
    const threads = Math.min(maxT, wantT);
    pid.push(ns.exec(
      script,
      bot,
      { temporary: true, threads },
      sleep,
      victim,
    ));
    security += ns.hackAnalyzeSecurity(threads);
    fracRemain = fracRemain * (1 - hackAnalyze * threads);
    if (threads === wantT) return { success: true, security, pid };
  }
  return { success: false, security: 0, pid };
}

function execW(
  ns: NS,
  sleep: number,
  victim: string,
  security: number,
): {
  success: boolean,
  pid: number[],
} {
  const script = botWeaken;
  const pid: number[] = [];
  for (const bot of autoscan(ns)) {
    const maxT = getMaxThreads(ns, { bot, script });
    const wantT = Math.ceil(security / ns.weakenAnalyze(1));
    const threads = Math.min(maxT, wantT);
    if (threads === 0) continue;
    pid.push(ns.exec(
      script,
      bot,
      { temporary: true, threads },
      sleep,
      victim,
    ));
    security = Math.max(0,
      security - ns.weakenAnalyze(threads)
    );
  }
  return { success: security === 0, pid };
}

function execG(
  ns: NS,
  sleep: number,
  victim: string,
  hackFrac: number,
): {
  success: boolean,
  pid: number[],
  security: number,
} {
  const script = botGrow;
  let wantT = Math.ceil(
    ns.growthAnalyze(victim, 1 / (1 - hackFrac))
  );
  let security = 0;
  const pid: number[] = [];
  for (const bot of autoscan(ns)) {
    const maxT = getMaxThreads(ns, { bot, script });
    const threads = Math.min(maxT, wantT);
    if (threads === 0) {
      continue;
    }
    wantT -= threads;
    pid.push(ns.exec(
      script,
      bot,
      { temporary: true, threads },
      sleep,
      victim,
    ));
    security += ns.growthAnalyzeSecurity(threads);
  }
  return { success: wantT === 0, pid, security };
}

function getMaxThreads(
  ns: NS,
  { bot, script }: { bot: string, script: string }
): number {
  const { maxRam, ramUsed, hasAdminRights } = ns.getServer(bot);
  if (!hasAdminRights) return 0;
  const perThread = ns.getScriptRam(script);
  return Math.floor(
    (maxRam - ramUsed) / perThread
  );
}
