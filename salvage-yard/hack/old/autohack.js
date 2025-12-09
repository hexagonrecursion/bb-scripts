const victim = 'iron-gym';
const reserveRam = {
  home: 32,
};
// mango is a randomly chosen word to avoid collisions
const botPrepareVictim = '/mango/prepare-victim.js';
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';
const extraSleepMs = 200;
const maxHackFrac = 0.5;

/** @param {NS} ns */
export async function main(ns) {
  let {
    botnetMaxThreads,
    ramPerThread,
    botnet
  } = prepareBotnet(ns);
  await prepareVictim(ns, {botnet});
  await prepareVictim(ns, {botnet});
  while (true) {
    await runHackBatch(
      ns,
      { botnetMaxThreads, ramPerThread, botnet }
    );
  }
}

/** @param {NS} ns */
async function runHackBatch(
  ns,
  { botnetMaxThreads, ramPerThread, botnet }
) {
  let { hT, w0T, gT, w1T } = binSearch(hT => {
    let hackFrac = ns.hackAnalyze(victim) * hT;
    if (hackFrac >= maxHackFrac) {
      return [false];
    }
    let gT = Math.ceil(ns.growthAnalyze(
      victim,
      1/(1-hackFrac)
    ));
    let w0T = getWeakenThreads(ns, {
      security: ns.hackAnalyzeSecurity(hT),
      botnetMaxThreads
    });
    let w1T = getWeakenThreads(ns, {
      security: ns.growthAnalyzeSecurity(gT),
      botnetMaxThreads
    });
    ns.print({
      //hackAnalyze: ns.hackAnalyze(victim),
      //hackFrac,
      hT,
      w0T,
      gT,
      w1T,
      botnetMaxThreads
    });
    return [
      hT + w0T + gT + w1T <= botnetMaxThreads,
      { hT, w0T, gT, w1T }
    ];
  },
    0,
    botnetMaxThreads
  );
  //ns.tprint({ hT, w0T, gT, w1T });
  let hackEnd = ns.getHackTime(victim);
  let weaken0End = Math.max(
    hackEnd + extraSleepMs,
    ns.getWeakenTime(victim)
  );
  let growEnd = Math.max(
    weaken0End + extraSleepMs,
    ns.getGrowTime(victim)
  );
  let weaken1End = Math.max(
    growEnd + extraSleepMs,
    ns.getWeakenTime(victim)
  );
  
  let hackSleep = 0;
  let weaken0Sleep = weaken0End - ns.getWeakenTime(victim);
  let growSleep = growEnd - ns.getGrowTime(victim);
  let weaken1Sleep = weaken1End - ns.getWeakenTime(victim);
  let selfSleep = weaken1End + extraSleepMs;

  execBots(ns, {
    ramPerThread,
    botnet,
    threads: hT,
    script: botHack,
    args: [hackSleep, victim]
  });
  execBots(ns, {
    ramPerThread,
    botnet,
    threads: w0T,
    script: botWeaken,
    args: [weaken0Sleep, victim]
  });
  execBots(ns, {
    ramPerThread,
    botnet,
    threads: gT,
    script: botGrow,
    args: [growSleep, victim]
  });
  execBots(ns, {
    ramPerThread,
    botnet,
    threads: w1T,
    script: botWeaken,
    args: [weaken1Sleep, victim]
  });
  await ns.sleep(selfSleep)
}

/** @param {NS} ns */
async function prepareVictim(ns, {botnet}) {
  let children = botnet.flatMap(bot => {
    let ramPerThread = ns.getScriptRam(botPrepareVictim);
    let freeRam = getUsableRam(ns, bot);
    let threads = Math.floor(freeRam / ramPerThread);
    if (threads === 0) {
      return [];
    }
    return [ns.exec(botPrepareVictim, bot, threads, victim)];
  });
  for (let childPid of children) {
    while (ns.isRunning(childPid)) {
      await ns.sleep(1000);
    }
  }
}

/** @param {NS} ns */
function prepareBotnet(ns) {
  let botnetMaxThreads = 0;
  let ramPerThread = Math.max(
    ...[
      botWeaken,
      botGrow,
      botHack
    ].map(script => ns.getScriptRam(script))
  );
  let botnet = autoscan(ns).filter(bot =>
    ns.hasRootAccess(bot)
  );
  for (let bot of botnet) {
    ns.scp([
      botWeaken,
      botGrow,
      botHack,
      botPrepareVictim
    ],
      bot,
      'home'
    );
    botnetMaxThreads += Math.floor(getUsableRam(ns, bot) / ramPerThread);
  }
  return { botnetMaxThreads, ramPerThread, botnet };
}

/** @param {NS} ns */
function autoscan(ns) {
  // https://www.reddit.com/r/Bitburner/comments/16u9akw/3_line_script_to_get_all_servers/
	let hosts = new Set(["home"]);
  hosts.forEach(h => { ns.scan(h).forEach(n => hosts.add(n)); });
	return Array.from(hosts);
}

/** @param {NS} ns */
function getWeakenThreads(ns, { security, botnetMaxThreads }) {
  return binSearch(threads => {
    //ns.tprint({threads, weakenAnalyze: ns.weakenAnalyze(threads), security})
    return [
      ns.weakenAnalyze(threads) >= security,
      threads
    ];
  },
    botnetMaxThreads,
    0
  );
}

function binSearch(cond, ok, overshoot) {
  let okData;
  while (Math.abs(overshoot - ok) >= 2) {
    let middle = Math.floor((overshoot + ok) / 2);
    let [isOk, data] = cond(middle);
    if (isOk) {
      ok = middle;
      okData = data;
    } else {
      overshoot = middle;
    }
  }
  return okData;
}

/** @param {NS} ns */
function execBots(
  ns,
  { botnet, ramPerThread, threads, script, args }
) {
  for (let bot of botnet) {
    let freeRam = getUsableRam(ns, bot);
    let t = Math.floor(freeRam / ramPerThread);
    t = Math.min(t, threads);
    if (t <= 0) continue;
    threads -= t;
    ns.exec(script, bot, t, ...args);
  }
}

/** @param {NS} ns */
function getUsableRam(ns, host) {
  let max = ns.getServerMaxRam(host);
  let used = ns.getServerUsedRam(host);
  let reserve = reserveRam[host] ?? 0;
  return Math.max(0, max - used - reserve);
}