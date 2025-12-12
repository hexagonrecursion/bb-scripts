export async function main(ns) {
  const possibleRoots = globalThis['document']
    .querySelectorAll('ul.MuiList-root');
  for(const elt of possibleRoots) {
    for(const prop in elt) {
      if(!prop.startsWith('__reactProps')) continue;
      const reactProps = elt[prop];
      for(const child of [reactProps.children].flat(Infinity)) {
        if(child?.props?.clickPage) {
          child.props.clickPage('Dev');
          return
        }
      }
    }
  }
}