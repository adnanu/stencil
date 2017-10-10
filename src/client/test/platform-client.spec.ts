import { ComponentMeta } from '../../util/interfaces';
import { ENCAPSULATION_TYPE } from '../../util/constants';
import { getModuleId } from '../platform-client';


describe('platform-client', () => {

  describe('getModuleId', () => {

    it('get scoped mode styles when component should use scoped css', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        moduleId: 'module-id',
        styleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ScopedCss
      };
      const mode = 'ios';
      const moduleId = getModuleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(moduleId).toBe('module-id.ios-id.sc');
    });

    it('get scoped mode styles when component should use shadow, but browser doesnt support shadow', () => {
      const supportsNativeShadowDom = false;
      const cmpMeta: ComponentMeta = {
        moduleId: 'module-id',
        styleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ShadowDom
      };
      const mode = 'ios';
      const moduleId = getModuleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(moduleId).toBe('module-id.ios-id.sc');
    });

    it('get mode styles, not scoped, when component not using encapsulation', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        moduleId: 'module-id',
        styleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.NoEncapsulation
      };
      const mode = 'ios';
      const moduleId = getModuleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(moduleId).toBe('module-id.ios-id');
    });

    it('get mode styles, not scoped, when supports native shadow and using shadow', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        moduleId: 'module-id',
        styleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ShadowDom
      };
      const mode = 'ios';
      const moduleId = getModuleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(moduleId).toBe('module-id.ios-id');
    });

    it('get only moduleId when theres no style', () => {
      const supportsNativeShadowDom = false;
      const cmpMeta: ComponentMeta = {
        moduleId: 'module-id',
        styleIds: {}
      };
      const mode = 'ios';
      const moduleId = getModuleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(moduleId).toBe('module-id');
    });

  });

});
