import { BuildConfig, BuildContext, CompiledModeStyles, ModuleFile, ManifestBundle } from '../../util/interfaces';
import { componentRequiresScopedStyles, generatePreamble, normalizePath } from '../util';
import { DEFAULT_STYLE_MODE } from '../../util/constants';
import { formatLoadComponents, formatLoadStyles } from '../../util/data-serialize';


export function generateBundles(config: BuildConfig, ctx: BuildContext, manifestBundles: ManifestBundle[]) {
  manifestBundles.forEach(manifestBundle => {
    generateBundleFiles(config, ctx, manifestBundle);
  });
}


function generateBundleFiles(config: BuildConfig, ctx: BuildContext, manifestBundle: ManifestBundle) {
  manifestBundle.compiledStyles = [];

  generateLoadComponents(config, ctx, manifestBundle);

  const modes = getManifestBundleModes(manifestBundle.moduleFiles);
  const hasDefaultMode = containsDefaultMode(modes);
  const hasNonDefaultModes = containsNonDefaultModes(modes);

  if (hasDefaultMode && hasNonDefaultModes) {
    // it's possible one component only has a default
    // and other components in the bundle have many modes
    // in this case, still create the many modes, but add
    // the same default to each of them
    modes.filter(m => m !== DEFAULT_STYLE_MODE).forEach(modeName => {
      const bundleStyles = manifestBundle.compiledModeStyles.filter(cms => cms.modeName === DEFAULT_STYLE_MODE);
      bundleStyles.push(...manifestBundle.compiledModeStyles.filter(cms => cms.modeName === modeName));

      generateBundleModeFiles(config, ctx, manifestBundle, modeName, bundleStyles);
    });

  } else if (modes.length > 0) {
    // has all modes, or just a default mode
    modes.forEach(modeName => {
      const bundleStyles = manifestBundle.compiledModeStyles.filter(cms => cms.modeName === modeName);

      generateBundleModeFiles(config, ctx, manifestBundle, modeName, bundleStyles);
    });

  } else {
    // no modes at all
    generateBundleModeFiles(config, ctx, manifestBundle, null, []);
  }
}


export function containsDefaultMode(modes: string[]) {
  return modes.some(m => m === DEFAULT_STYLE_MODE);
}


export function containsNonDefaultModes(modes: string[]) {
  return modes.length > 0 && modes.some(m => m !== DEFAULT_STYLE_MODE);
}


function generateBundleModeFiles(config: BuildConfig, ctx: BuildContext, manifestBundle: ManifestBundle, modeName: string, bundleStyles: CompiledModeStyles[]) {
  const moduleId = manifestBundle.compiledModule.moduleId;

  if (modeName && bundleStyles.length) {
    let scopedStyles = false;
    const unscopedStyleContent = formatLoadStyles(config.namespace, bundleStyles, scopedStyles);
    const styleId = generateStyleId(config, modeName, unscopedStyleContent);

    manifestBundle.compiledStyles.push({
      modeName: modeName,
      styleId: styleId
    });

    // unscoped styles
    writeBundleFile(config, ctx, moduleId, styleId, [
      unscopedStyleContent,
      manifestBundle.compiledModule.moduleText
    ], scopedStyles);

    if (bundleRequiresScopedStyles(manifestBundle.moduleFiles)) {
      // scoped styles (uses the same style id)
      scopedStyles = true;
      const scopedStyleContent = formatLoadStyles(config.namespace, bundleStyles, scopedStyles);
      writeBundleFile(config, ctx, moduleId, styleId, [
        scopedStyleContent,
        manifestBundle.compiledModule.moduleText
      ], scopedStyles);
    }

  } else {
    // no styles at all
    writeBundleFile(config, ctx, moduleId, null, [
      manifestBundle.compiledModule.moduleText
    ], false);
  }
}


export function writeBundleFile(config: BuildConfig, ctx: BuildContext, moduleId: string, styleId: string, contents: string[], scoped: boolean) {
  const fileContent = generatePreamble(config) + contents.join('\n');

  const fileName = getBundleFileName(moduleId, styleId, scoped);

  const wwwBuildPath = normalizePath(config.sys.path.join(
    config.buildDir,
    config.namespace.toLowerCase(),
    fileName
  ));

  // use wwwFilePath as the cache key
  if (ctx.compiledFileCache[wwwBuildPath] === fileContent) {
    // unchanged, no need to resave
    return false;
  }

  // cache for later
  ctx.compiledFileCache[wwwBuildPath] = fileContent;

  if (config.generateWWW) {
    ctx.filesToWrite[wwwBuildPath] = fileContent;
  }

  if (config.generateDistribution) {
    const distPath = normalizePath(config.sys.path.join(
      config.distDir,
      config.namespace.toLowerCase(),
      fileName
    ));

    ctx.filesToWrite[distPath] = fileContent;
  }

  return true;
}


export function getBundleFileName(moduleId: string, styleId: string, scoped: boolean) {
  const fileName: string[] = [moduleId];

  if (styleId) {
    fileName.push(styleId);
  }

  if (scoped) {
    fileName.push('sc');
  }

  fileName.push('js');

  return fileName.join('.');
}


function generateLoadComponents(config: BuildConfig, ctx: BuildContext, manifestBundle: ManifestBundle) {
  manifestBundle.compiledModule.moduleText = formatLoadComponents(config.namespace, STENCIL_BUNDLE_ID, manifestBundle.compiledModule.moduleText, manifestBundle.moduleFiles);

  if (config.minifyJs) {
    // minify js
    const minifyJsResults = config.sys.minifyJs(manifestBundle.compiledModule.moduleText);
    minifyJsResults.diagnostics.forEach(d => {
      ctx.diagnostics.push(d);
    });

    if (!minifyJsResults.diagnostics.length) {
      manifestBundle.compiledModule.moduleText = minifyJsResults.output + ';';
    }
  }

  if (config.hashFileNames) {
    // create module id from hashing the content
    manifestBundle.compiledModule.moduleId = config.sys.generateContentHash(manifestBundle.compiledModule.moduleText, config.hashedFileNameLength);

  } else {
    // create module id from list of component tags in this file
    // can get a lil too long, so let's just use the first tag
    manifestBundle.compiledModule.moduleId = manifestBundle.components[0];
  }

  // replace the known bundle id template with the newly created bundle id
  manifestBundle.compiledModule.moduleText = manifestBundle.compiledModule.moduleText.replace(MODULE_ID_REGEX, manifestBundle.compiledModule.moduleId);
}


export function generateStyleId(config: BuildConfig, modeName: string, styleContent: string) {
  if (config.hashFileNames) {
    // create style id from hashing the content
    return config.sys.generateContentHash(styleContent, config.hashedFileNameLength);
  }

  if (modeName === DEFAULT_STYLE_MODE) {
    return null;
  }

  return modeName;
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


const STENCIL_BUNDLE_ID = '__STENCIL__BUNDLE__ID__';
const MODULE_ID_REGEX = new RegExp(STENCIL_BUNDLE_ID, 'g');
