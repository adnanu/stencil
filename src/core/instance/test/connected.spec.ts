import { ComponentMeta } from '../../../util/interfaces';
import { ENCAPSULATION_TYPE } from '../../../util/constants';
import { getBundleId } from '../connected';
import { waitForLoad, mockConnect, mockDefine, mockPlatform } from '../../../testing/mocks';


describe('connected', () => {

  describe('instance connected', () => {
    const plt = mockPlatform();

    it('should create $instance', () => {
      mockDefine(plt, { tagNameMeta: 'ion-test' });

      const node = mockConnect(plt, '<ion-test></ion-test>');
      return waitForLoad(plt, node, 'ion-test').then(elm => {
        expect(elm.$instance).toBeDefined();
      });
    });

    it('should set $connected', () => {
      mockDefine(plt, { tagNameMeta: 'ion-test' });

      const node = mockConnect(plt, '<ion-test></ion-test>');
      return waitForLoad(plt, node, 'ion-test').then(elm => {
        expect(elm.$connected).toBe(true);
      });
    });

  });

  describe('getBundleId', () => {

    it('get scoped mode styles when component should use scoped css', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        bundleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ScopedCss
      };
      const mode = 'ios';
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('ios-id.sc');
    });

    it('get scoped mode styles when component should use shadow, but browser doesnt support shadow', () => {
      const supportsNativeShadowDom = false;
      const cmpMeta: ComponentMeta = {
        bundleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ShadowDom
      };
      const mode = 'ios';
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('ios-id.sc');
    });

    it('get mode styles, not scoped, when component not using encapsulation', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        bundleIds: { 'ios': 'ios-id' }
      };
      const mode = 'ios';
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('ios-id');
    });

    it('get mode styles, not scoped, when supports native shadow and using shadow', () => {
      const supportsNativeShadowDom = true;
      const cmpMeta: ComponentMeta = {
        bundleIds: { 'ios': 'ios-id' },
        encapsulation: ENCAPSULATION_TYPE.ShadowDom
      };
      const mode = 'ios';
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('ios-id');
    });

    it('get only bundleId from string', () => {
      const supportsNativeShadowDom = false;
      const cmpMeta: ComponentMeta = {};
      (cmpMeta.bundleIds as any) = 'bundle-id';
      const mode = 'ios';
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('bundle-id');
    });

    it('get only bundleId from string with null mode', () => {
      const supportsNativeShadowDom = false;
      const cmpMeta: ComponentMeta = {};
      (cmpMeta.bundleIds as any) = 'bundle-id';
      const mode: string = null;
      const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, mode);
      expect(bundleId).toBe('bundle-id');
    });

  });

});
