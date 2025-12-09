export async function main(ns: NS) {
  for(let r = 1; r <= ns.getPurchasedServerMaxRam(); r*=2) {
    ns.tprintf(
      '%s $%s',
      ns.formatRam(r),
      ns.formatNumber(ns.getPurchasedServerCost(r)),
    );
  }
}