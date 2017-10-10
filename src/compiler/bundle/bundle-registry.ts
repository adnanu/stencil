import { ComponentRegistry, Manifest, ModuleResults, StylesResults } from '../../util/interfaces';


export function generateComponentRegistry(manifest: Manifest, styleResults: StylesResults, moduleResults: ModuleResults) {
  const registry: ComponentRegistry = {};

  // create the minimal registry component data for each bundle
  styleResults.bundleStyles.forEach(moduleFile => {
    // a bundle id is made of of each component tag name
    // separated by a period
    const componentTags = bundleId.split('.');
    const styleResult = styleResults[bundleId];

    componentTags.forEach(tag => {
      const registryTag = tag.toLowerCase();

      // merge up the style id to the style data
      if (!registry[registryTag]) {
        const moduleFile = manifest.modulesFiles.find(modulesFile => {
          return modulesFile.cmpMeta.tagNameMeta === tag;
        });

        if (moduleFile) {
          registry[registryTag] = moduleFile.cmpMeta;
        }
      }

      if (registry[registryTag]) {
        registry[registryTag].stylesMeta = registry[registryTag].stylesMeta || {};

        if (styleResult) {
          Object.keys(styleResult).forEach(modeName => {
            registry[registryTag].stylesMeta[modeName] = registry[registryTag].stylesMeta[modeName] || {};
            registry[registryTag].stylesMeta[modeName].styleId = styleResult[modeName].styleId;
          });
        }
      }
    });
  });

  Object.keys(moduleResults).forEach(bundleId => {
    const componentTags = bundleId.split('.');
    const moduleId = moduleResults[bundleId].moduleId;

    componentTags.forEach(tag => {
      const registryTag = tag.toLowerCase();

      if (!registry[registryTag]) {
        const moduleFile = manifest.modulesFiles.find(modulesFile => {
          return modulesFile.cmpMeta.tagNameMeta === tag;
        });

        if (moduleFile) {
          registry[registryTag] = moduleFile.cmpMeta;
        }
      }

      if (registry[registryTag]) {
        registry[registryTag].moduleId = moduleId;
      }
    });
  });

  return registry;
}
