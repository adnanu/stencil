import { ComponentMeta, ComponentRegistry, ManifestBundle } from '../../util/interfaces';


export function generateComponentRegistry(manifestBundles: ManifestBundle[]) {
  let registryComponents: ComponentMeta[] = [];

  manifestBundles.forEach(manifestBundle => {
    fillBundleRegistry(registryComponents, manifestBundle);
  });

  registryComponents = registryComponents.sort((a, b) => {
    if (a.tagNameMeta < b.tagNameMeta) return -1;
    if (a.tagNameMeta > b.tagNameMeta) return 1;
    return 0;
  });

  const registry: ComponentRegistry = {};

  registryComponents.forEach(cmpMeta => {
    registry[cmpMeta.tagNameMeta] = cmpMeta;
  });

  return registry;
}


function fillBundleRegistry(registryComponents: ComponentMeta[], manifestBundle: ManifestBundle) {
  manifestBundle.moduleFiles.filter(m => m.cmpMeta).forEach(moduleFile => {

    // fillStylesRegistry(manifestBundle.compiledStyles, moduleFile.cmpMeta);

    registryComponents.push(moduleFile.cmpMeta);
  });
}


// export function fillStylesRegistry(compiledStyles: CompiledStyle[], cmpMeta: ComponentMeta) {
//   cmpMeta.stylesMeta = cmpMeta.stylesMeta || {};

//   compiledStyles.sort((a, b) => {
//     if (a.modeName < b.modeName) return -1;
//     if (a.modeName > b.modeName) return 1;
//     return 0;

//   }).forEach(compiledModeStyle => {
//     const modeName = compiledModeStyle.modeName;

//     cmpMeta.stylesMeta[modeName] = cmpMeta.stylesMeta[modeName] || {};

//     cmpMeta.stylesMeta[modeName].styleId = compiledModeStyle.styleId;
//   });
// }
