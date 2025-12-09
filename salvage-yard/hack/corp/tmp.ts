export async function main(ns: NS) {
  const {producedMaterials} = ns.corporation.getIndustryData('Agriculture');
  for(const m of producedMaterials) {
    ns.tprint(ns.corporation.getMaterialData(m));
  }
  
}