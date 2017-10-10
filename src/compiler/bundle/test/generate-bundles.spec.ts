import { BuildConfig, BuildContext, Bundle, ComponentMeta, ModuleFile } from '../../../util/interfaces';
import {
  bundleRequiresScopedStyles,
  containsDefaultMode,
  containsNonDefaultModes,
  getBundleFileName,
  getManifestBundleModes,
  generateStyleId,
  writeBundleFile
} from '../generate-bundles';
import { ENCAPSULATION_TYPE } from '../../../util/constants';
import { mockStencilSystem } from '../../../testing/mocks';


describe('generate-bundles', () => {

  describe('containsNonDefaultModes', () => {

    it('should not contain non default', () => {
      expect(containsDefaultMode(['ios'])).toBe(false);
      expect(containsDefaultMode([])).toBe(false);
    });

    it('should contain non default', () => {
      expect(containsNonDefaultModes(['$', 'ios'])).toBe(true);
    });

  });

  describe('containsDefaultMode', () => {

    it('should not contain default', () => {
      expect(containsDefaultMode(['ios', 'md'])).toBe(false);
      expect(containsDefaultMode([])).toBe(false);
    });

    it('should contain default', () => {
      expect(containsDefaultMode(['$', 'ios'])).toBe(true);
    });

  });

  describe('writeBundleFile', () => {

    it('should write www/build and dist', () => {
      const config: BuildConfig = {
        generateWWW: true,
        generateDistribution: true,
        namespace: 'App',
        buildDir: 'build',
        distDir: 'dist'
      };
      config.sys = mockStencilSystem();
      const ctx: BuildContext = {
        compiledFileCache: {},
        filesToWrite: {}
      };
      writeBundleFile(config, ctx, 'module-id', null, [''], false);
      expect(ctx.filesToWrite['build/app/module-id.js']).toBeDefined();
      expect(ctx.filesToWrite['dist/app/module-id.js']).toBeDefined();
    });

    it('should not write if content is the same', () => {
      const config: BuildConfig = { namespace: 'App', buildDir: 'build' };
      config.sys = mockStencilSystem();
      const ctx: BuildContext = { compiledFileCache: {} };
      writeBundleFile(config, ctx, 'module-id', null, [''], false);
      const didWrite = writeBundleFile(config, ctx, 'module-id', null, [''], false);
      expect(didWrite).toBe(false);
    });

    it('should write if new content', () => {
      const config: BuildConfig = { namespace: 'App', buildDir: 'build' };
      config.sys = mockStencilSystem();
      const ctx: BuildContext = { compiledFileCache: {} };
      const didWrite = writeBundleFile(config, ctx, 'module-id', null, [''], false);
      expect(didWrite).toBe(true);
    });

  });

  describe('getBundleFileName', () => {

    it('get filename from module id, scope id and scoped', () => {
      const fileName = getBundleFileName('module-id', 'style-id', true);
      expect(fileName).toBe('module-id.style-id.sc.js');
    });

    it('get filename from module id and scope id', () => {
      const fileName = getBundleFileName('module-id', 'style-id', false);
      expect(fileName).toBe('module-id.style-id.js');
    });

    it('get filename from module id and scoped', () => {
      const fileName = getBundleFileName('module-id', null, true);
      expect(fileName).toBe('module-id.sc.js');
    });

    it('get filename from module id only', () => {
      const fileName = getBundleFileName('module-id', null, false);
      expect(fileName).toBe('module-id.js');
    });

  });

  describe('generateStyleId', () => {

    it('get style id from hashed content', () => {
      const config: BuildConfig = { hashFileNames: true, hashedFileNameLength: 4 };
      config.sys = mockStencilSystem();

      const styleId = generateStyleId(config, 'ios', 'h1{color:blue;}');

      expect(styleId).toBe('ehrd');
    });

    it('get style id from components and mode', () => {
      const config: BuildConfig = {};
      const styleId = generateStyleId(config, 'ios', 'h1{color:blue;}');

      expect(styleId).toBe('ios');
    });

    it('get style id from components and default mode', () => {
      const config: BuildConfig = {};
      const styleId = generateStyleId(config, '$', 'h1{color:blue;}');

      expect(styleId).toBe(null);
    });

  });

  describe('getManifestBundleModes', () => {

    it('get all modes', () => {
      const allModuleFiles: ModuleFile[] =  [
        { cmpMeta: { tagNameMeta: 'cmp-d', stylesMeta: { ios: {}, md: {} } } },
        { cmpMeta: { tagNameMeta: 'cmp-a', stylesMeta: { $: {}, md: {} } } },
        { cmpMeta: { tagNameMeta: 'cmp-b', stylesMeta: { ios: {}, wp: {} } } },
        { cmpMeta: { tagNameMeta: 'cmp-c' } },
        { }
      ];

      const modes = getManifestBundleModes(allModuleFiles);

      expect(modes[0]).toBe('$');
      expect(modes[1]).toBe('ios');
      expect(modes[2]).toBe('md');
      expect(modes[3]).toBe('wp');
      expect(modes.length).toBe(4);
    });

  });

  describe('bundleRequiresScopedStyles', () => {

    it('scoped styles required for shadow dom w/ styles', () => {
      const allModuleFiles: ModuleFile[] =  [
        { cmpMeta: { tagNameMeta: 'cmp-d', encapsulation: ENCAPSULATION_TYPE.ShadowDom, stylesMeta: {} } },
        { cmpMeta: { tagNameMeta: 'cmp-a', stylesMeta: { $: {}, md: {} } } },
        { }
      ];

      const isRequired = bundleRequiresScopedStyles(allModuleFiles);
      expect(isRequired).toBe(true);
    });

    it('scoped styles required for scoped css w/ styles', () => {
      const allModuleFiles: ModuleFile[] =  [
        { cmpMeta: { tagNameMeta: 'cmp-d', encapsulation: ENCAPSULATION_TYPE.ScopedCss, stylesMeta: {} } },
        { cmpMeta: { tagNameMeta: 'cmp-a', stylesMeta: { $: {}, md: {} } } },
        { }
      ];

      const isRequired = bundleRequiresScopedStyles(allModuleFiles);
      expect(isRequired).toBe(true);
    });

    it('scoped styles not required', () => {
      const allModuleFiles: ModuleFile[] =  [
        { cmpMeta: { tagNameMeta: 'cmp-a', stylesMeta: { $: {}, md: {} } } },
        { }
      ];

      const isRequired = bundleRequiresScopedStyles(allModuleFiles);
      expect(isRequired).toBe(false);
    });

  });

});
