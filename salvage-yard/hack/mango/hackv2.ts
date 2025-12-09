const flags = [
  ['victim', ''],
  ['additional-msec', 0],
  ['write-log', false],
] as [string, number][];

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  data.flags(flags);
  return [];
}

export async function main(ns: NS) {
  ns.print(ns.args);
  const {
    victim,
    'additional-msec': additionalMsec,
    'write-log': writeLog,
  } = ns.flags(flags);
  if(
    typeof victim !== 'string' || victim === ''
    || typeof additionalMsec !== 'number' || additionalMsec < 0
    || typeof writeLog !== 'boolean'
  ) {
    throw ('hack ' 
      + `victim ${victim} `
      + `additionalMsec ${additionalMsec} `
      + `writeLog ${writeLog}`);
  }
  const {parent, threads} = ns.self();
  const log: any = {
    victim,
    additionalMsec,
    start: Date.now(),
    threads,
  };
  const logName = `/mango/logs/${parent}/${ns.pid}.json`
  if(writeLog) {
    ns.write(logName, JSON.stringify(log));
  }
  log.earnedMoney = await ns.hack(victim, { additionalMsec });
  log.end = Date.now();
  if(writeLog) {
    ns.write(logName, JSON.stringify(log));
  }
}