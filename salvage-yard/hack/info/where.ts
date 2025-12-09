export async function main(ns: NS) {
  let h = ns.args[0];
  if(typeof h !== 'string') {
    ns.tprintf('Usage:\n%s I.I.I.I', ns.getScriptName());
    return;
  }
  while (h !== 'home') {
    await ns.sleep(0);
    ns.tprintf('%s', h);
    h = ns.scan(h)[0]
  }
}

export function autocomplete(
  data: AutocompleteData,
  args: string[],
): string[] {
  return [...data.servers];
}
