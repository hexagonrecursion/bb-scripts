export async function main(ns: NS) {
  f(ns, 0, Date.now());
}

function f(ns, i, s) {
  if(Date.now() - s > 2000) {
    ns.tprint(i);
    ns.tprint('timeout');
    return;
  }
  try {
    f(ns, i+1, s);
  }catch(e) {
    ns.tprint(e);
    ns.tprint(i);
  }
}