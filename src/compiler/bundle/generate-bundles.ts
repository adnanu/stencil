import { BuildConfig, BuildContext, ComponentMeta, ComponentRegistry, CompiledModeStyles, ModuleFile, ManifestBundle } from '../../util/interfaces';
import { componentRequiresScopedStyles, generatePreamble, normalizePath } from '../util';
import { DEFAULT_STYLE_MODE } from '../../util/constants';
import { formatLoadComponents, formatLoadStyles } from '../../util/data-serialize';
import { getAppFileName } from '../app/generate-app-files';


export function generateBundles(config: BuildConfig, ctx: BuildContext, manifestBundles: ManifestBundle[]) {
  manifestBundles.forEach(manifestBundle => {
    generateBundleFiles(config, ctx, manifestBundle);
  });

  ctx.registry = generateComponentRegistry(manifestBundles);
}


function generateBundleFiles(config: BuildConfig, ctx: BuildContext, manifestBundle: ManifestBundle) {
  manifestBundle.moduleFiles.forEach(moduleFile => {
    moduleFile.cmpMeta.bundleIds = {};
  });

  let moduleText = formatLoadComponents(config.namespace, MODULE_ID, manifestBundle.compiledModuleText, manifestBundle.moduleFiles);

  if (config.minifyJs) {
    // minify js
    const minifyJsResults = config.sys.minifyJs(moduleText);
    minifyJsResults.diagnostics.forEach(d => {
      ctx.diagnostics.push(d);
    });

    if (!minifyJsResults.diagnostics.length) {
      moduleText = minifyJsResults.output + ';';
    }
  }

  const modes = getManifestBundleModes(manifestBundle.moduleFiles);
  const hasDefaultMode = containsDefaultMode(modes);
  const hasNonDefaultModes = containsNonDefaultModes(modes);

  if (hasDefaultMode && hasNonDefaultModes) {
    modes.filter(m => m !== DEFAULT_STYLE_MODE).forEach(modeName => {
      const bundleStyles = manifestBundle.compiledModeStyles.filter(cms => cms.modeName === DEFAULT_STYLE_MODE);
      bundleStyles.push(...manifestBundle.compiledModeStyles.filter(cms => cms.modeName === modeName));

      writeBundleFile(config, ctx, manifestBundle, moduleText, modeName, bundleStyles);
    });

  } else if (modes.length) {
    modes.forEach(modeName => {
      const bundleStyles = manifestBundle.compiledModeStyles.filter(cms => cms.modeName === modeName);

      writeBundleFile(config, ctx, manifestBundle, moduleText, modeName, bundleStyles);
    });

  } else {
    writeBundleFile(config, ctx, manifestBundle, moduleText, null, []);
  }
}


export function writeBundleFile(config: BuildConfig, ctx: BuildContext, manifestBundle: ManifestBundle, moduleText: string, modeName: string, bundleStyles: CompiledModeStyles[]) {
  const unscopedStyleText = formatLoadStyles(config.namespace, bundleStyles, false);

  const unscopedContents = [
    generatePreamble(config)
  ];
  if (unscopedStyleText.length) {
    unscopedContents.push(unscopedStyleText);
  }
  unscopedContents.push(moduleText);

  let unscopedContent = unscopedContents.join('\n');

  const bundleId = getBundleId(config, manifestBundle.components, modeName, unscopedContent);

  unscopedContent = replaceDefaulBundleId(unscopedContent, bundleId);

  const unscopedFileName = getBundleFileName(bundleId, false);

  manifestBundle.moduleFiles.forEach(moduleFile => {
    if (modeName) {
      moduleFile.cmpMeta.bundleIds[modeName] = bundleId;
    } else {
      moduleFile.cmpMeta.bundleIds[DEFAULT_STYLE_MODE] = bundleId;
    }
  });

  const unscopedWwwBuildPath = normalizePath(config.sys.path.join(
    config.buildDir,
    getAppFileName(config),
    unscopedFileName
  ));

  // use wwwFilePath as the cache key
  if (ctx.compiledFileCache[unscopedWwwBuildPath] === unscopedContent) {
    // unchanged, no need to resave
    return false;
  }

  // cache for later
  ctx.compiledFileCache[unscopedWwwBuildPath] = unscopedContent;

  if (config.generateWWW) {
    ctx.filesToWrite[unscopedWwwBuildPath] = unscopedContent;
  }

  if (config.generateDistribution) {
    const unscopedDistPath = normalizePath(config.sys.path.join(
      config.distDir,
      getAppFileName(config),
      unscopedFileName
    ));

    ctx.filesToWrite[unscopedDistPath] = unscopedContent;
  }

  if (modeName && bundleRequiresScopedStyles(manifestBundle.moduleFiles)) {
    const scopedStyleText = formatLoadStyles(config.namespace, bundleStyles, true);

    const scopedContents = [
      generatePreamble(config)
    ];

    if (scopedStyleText.length) {
      scopedContents.push(scopedStyleText);
    }
    scopedContents.push(moduleText);

    const scopedFileContent = replaceDefaulBundleId(scopedContents.join('\n'), bundleId);

    const scopedFileName = getBundleFileName(bundleId, true);

    if (config.generateWWW) {
      const scopedWwwPath = normalizePath(config.sys.path.join(
        config.buildDir,
        getAppFileName(config),
        scopedFileName
      ));

      ctx.filesToWrite[scopedWwwPath] = scopedFileContent;
    }

    if (config.generateDistribution) {
      const scopedDistPath = normalizePath(config.sys.path.join(
        config.distDir,
        getAppFileName(config),
        scopedFileName
      ));

      ctx.filesToWrite[scopedDistPath] = scopedFileContent;
    }
  }

  return true;
}


export function generateComponentRegistry(manifestBundles: ManifestBundle[]) {
  const registryComponents: ComponentMeta[] = [];
  const registry: ComponentRegistry = {};

  manifestBundles.forEach(manifestBundle => {
    manifestBundle.moduleFiles.filter(m => m.cmpMeta).forEach(moduleFile => {
      registryComponents.push(moduleFile.cmpMeta);
    });
  });

  registryComponents.sort((a, b) => {
    if (a.tagNameMeta < b.tagNameMeta) return -1;
    if (a.tagNameMeta > b.tagNameMeta) return 1;
    return 0;

  }).forEach(cmpMeta => {
    registry[cmpMeta.tagNameMeta] = cmpMeta;
  });

  return registry;
}


export function getBundleFileName(moduleId: string, scoped: boolean) {
  const fileName: string[] = [moduleId];

  if (scoped) {
    fileName.push('sc');
  }

  fileName.push('js');

  return fileName.join('.');
}


export function getBundleId(config: BuildConfig, components: string[], modeName: string, content: string) {
  if (config.hashFileNames) {
    // create style id from hashing the content
    return config.sys.generateContentHash(content, config.hashedFileNameLength);
  }

  if (modeName === DEFAULT_STYLE_MODE || !modeName) {
    return components[0];
  }

  return components[0] + '.' + modeName;
}


export function getManifestBundleModes(moduleFiles: ModuleFile[]) {
  const modes: string[] = [];

  moduleFiles.forEach(m => {
    if (m.cmpMeta && m.cmpMeta.stylesMeta) {
      Object.keys(m.cmpMeta.stylesMeta).forEach(modeName => {
        if (modes.indexOf(modeName) === -1) {
          modes.push(modeName);
        }
      });
    }
  });

  return modes.sort();
}


export function bundleRequiresScopedStyles(moduleFiles: ModuleFile[]) {
  return moduleFiles
          .filter(m => m.cmpMeta && m.cmpMeta.stylesMeta)
          .some(m => componentRequiresScopedStyles(m.cmpMeta.encapsulation));
}


export function containsDefaultMode(modes: string[]) {
  return modes.some(m => m === DEFAULT_STYLE_MODE);
}


export function containsNonDefaultModes(modes: string[]) {
  return modes.length > 0 && modes.some(m => m !== DEFAULT_STYLE_MODE);
}


function replaceDefaulBundleId(fileContent: string, newModuleId: string) {
  return fileContent.replace(MODULE_ID_REGEX, newModuleId);
}


const MODULE_ID = '__STENCIL__MODULE__ID__';
const MODULE_ID_REGEX = new RegExp(MODULE_ID, 'g');
