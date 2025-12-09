import lib from './lib.ts';

// mango is a randomly chosen word to avoid collisions
const botWeaken = '/mango/weaken.js';
const botGrow = '/mango/grow.js';
const botHack = '/mango/hack.js';

export async function main(ns: NS) {
  const {
    getServer,
    isNeedWeaken,
    isNeedGrow,
    autoscan,
    autoKillAtExit,
  } = lib(ns);
  async function bootstrap() {
    const victim = 'n00dles';
    while (true) {
      if (isNeedWeaken(victim)) {
        await execMax(victim, botWeaken);
        continue;
      }
      if (isNeedGrow(victim)) {
        await execMax(victim, botGrow);
        continue;
      }
      break;
    }
    await execMax(victim, botHack);
  }

  async function execMax(victim: string, script: string) {
    const perThread = ns.getScriptRam(script);
    const children = [];
    for (const h of autoscan()) {
      const { ramUsed, maxRam, hasAdminRights } = ns.getServer(h);
      const threads = Math.floor((maxRam - ramUsed) / perThread);
      if (threads === 0 || !hasAdminRights) {
        continue;
      }
      children.push(ns.exec(
        script, h, { threads, temporary: true }, 0, victim
      ));
    }
    for (const childPid of children) {
      while (ns.isRunning(childPid)) {
        await ns.sleep(1000);
      }
    }
  }
  function copyHelpers() {
    for (const server of autoscan()) {
      ns.scp([
        botWeaken,
        botGrow,
        botHack,
      ],
        server,
        'home'
      );
    }
  }

  function autonuke() {
    for (const h of autoscan()) {
      if (getServer(h).hasAdminRights) {
        continue;
      }
      try { ns.brutessh(h); } catch (e) { }
      try { ns.ftpcrack(h); } catch (e) { }
      try { ns.relaysmtp(h); } catch (e) { }
      try { ns.httpworm(h); } catch (e) { }
      try { ns.sqlinject(h); } catch (e) { }
      try { ns.nuke(h); } catch (e) { }
    }
  }
  function purchaseServers() {
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
  for(let i = 0; i < 2; ++i) {
    autonuke();
    purchaseServers();
    copyHelpers();
    await bootstrap();
  }
}