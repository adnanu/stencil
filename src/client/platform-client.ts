import { addEventListener, enableEventListener } from '../core/instance/listeners';
import { assignHostContentSlots, createVNodesFromSsr } from '../core/renderer/slot';
import { AppGlobal, BundleCallbacks, ComponentMeta, ComponentRegistry, CoreContext,
  EventEmitterData, HostElement, LoadComponentRegistry, PlatformApi } from '../util/interfaces';
import { createDomControllerClient } from './dom-controller-client';
import { createDomApi } from '../core/renderer/dom-api';
import { createRendererPatch } from '../core/renderer/patch';
import { createQueueClient } from './queue-client';
import { getBundleId } from '../core/instance/connected';
import { h, t } from '../core/renderer/h';
import { initHostConstructor } from '../core/instance/init';
import { parseComponentMeta, parseComponentRegistry } from '../util/data-parse';
import { proxyController } from '../core/instance/proxy';
import { SSR_VNODE_ID } from '../util/constants';
import { useShadowDom } from '../core/renderer/encapsulation';


export function createPlatformClient(Context: CoreContext, App: AppGlobal, win: Window, doc: Document, publicPath: string, hydratedCssClass: string): PlatformApi {
  const registry: ComponentRegistry = { 'html': {} };
  const moduleImports: {[tag: string]: any} = {};
  const bundleCallbacks: BundleCallbacks = {};
  const loadedBundles: {[bundleId: string]: boolean} = {};
  const styleTemplates: StyleTemplates = {};
  const pendingBundleRequests: {[url: string]: boolean} = {};
  const controllerComponents: {[tag: string]: HostElement} = {};
  const domApi = createDomApi(doc);
  const now = () => win.performance.now();

  // initialize Core global object
  Context.dom = createDomControllerClient(win, now);

  Context.addListener = function addListener(elm, eventName, cb, opts) {
    return addEventListener(plt, elm, eventName, cb, opts && opts.capture, opts && opts.passive);
  };

  Context.enableListener = function enableListener(instance, eventName, enabled, attachTo) {
    enableEventListener(plt, instance, eventName, enabled, attachTo);
  };

  Context.emit = function emitEvent(elm: Element, eventName: string, data: EventEmitterData) {
    elm && elm.dispatchEvent(new WindowCustomEvent(
      Context.eventNameFn ? Context.eventNameFn(eventName) : eventName,
      data
    ));
  };

  Context.isClient = true;
  Context.isServer = Context.isPrerender = false;
  Context.window = win;
  Context.location = win.location;
  Context.document = doc;

  // keep a global set of tags we've already defined
  const globalDefined: string[] = (win as any).definedComponents = (win as any).definedComponents || [];

  // create the platform api which is used throughout common core code
  const plt: PlatformApi = {
    registerComponents,
    defineComponent,
    isDefinedComponent,
    getComponentMeta,
    propConnect,
    getContextItem,
    loadBundle,
    queue: createQueueClient(Context.dom, now),
    connectHostElement,
    cloneComponentStyle,
    emitEvent: Context.emit,
    getEventOptions,
    onError,
    isClient: true
  };

  const supportsNativeShadowDom = !!(domApi.$body.attachShadow && (domApi.$body as any).getRootNode);

  // create the renderer that will be used
  plt.render = createRendererPatch(plt, domApi, supportsNativeShadowDom);

  // setup the root element which is the mighty <html> tag
  // the <html> has the final say of when the app has loaded
  const rootElm = <HostElement>domApi.$documentElement;
  rootElm.$rendered = true;
  rootElm.$activeLoading = [];
  rootElm.$initLoad = function appLoadedCallback() {
    // this will fire when all components have finished loaded
    rootElm._hasLoaded = true;
  };


  // if the HTML was generated from SSR
  // then let's walk the tree and generate vnodes out of the data
  createVNodesFromSsr(domApi, rootElm);


  function getComponentMeta(elm: Element) {
    // get component meta using the element
    // important that the registry has upper case tag names
    return registry[elm.tagName.toLowerCase()];
  }

  function connectHostElement(cmpMeta: ComponentMeta, elm: HostElement) {
    // set the "mode" property
    if (!elm.mode) {
      // looks like mode wasn't set as a property directly yet
      // first check if there's an attribute
      // next check the app's global
      elm.mode = domApi.$getAttribute(elm, 'mode') || Context.mode;
    }

    // host element has been connected to the DOM
    if (!domApi.$getAttribute(elm, SSR_VNODE_ID) && !useShadowDom(supportsNativeShadowDom, cmpMeta)) {
      // only required when we're not using native shadow dom (slot)
      // this host element was NOT created with SSR
      // let's pick out the inner content for slot projection
      assignHostContentSlots(domApi, elm, cmpMeta.slotMeta);
    }
  }


  function registerComponents(components: LoadComponentRegistry[]) {
    // this is the part that just registers the minimal amount of data
    // it's basically a map of the component tag name to its associated external bundles
    return (components || []).map(data => parseComponentRegistry(data, registry));
  }


  function defineComponent(cmpMeta: ComponentMeta, HostElementConstructor: any) {
    const tagName = cmpMeta.tagNameMeta.toLowerCase();

    if (globalDefined.indexOf(tagName) === -1) {
      // keep an array of all the defined components, useful for external frameworks
      globalDefined.push(tagName);

      // initialize the properties on the component module prototype
      initHostConstructor(plt, HostElementConstructor.prototype, hydratedCssClass);

      // add which attributes should be observed
      const observedAttributes: string[] = [];

      // at this point the membersMeta only includes attributes which should
      // be observed, it does not include all props yet, so it's safe to
      // loop through all of the props (attrs) and observed them
      for (var propName in cmpMeta.membersMeta) {
        // initialize the actual attribute name used vs. the prop name
        // for example, "myProp" would be "my-prop" as an attribute
        // and these can be configured to be all lower case or dash case (default)
        if (cmpMeta.membersMeta[propName].attribName) {
          observedAttributes.push(
            // dynamically generate the attribute name from the prop name
            // also add it to our array of attributes we need to observe
            cmpMeta.membersMeta[propName].attribName
          );
        }
      }

      // set the array of all the attributes to keep an eye on
      // https://www.youtube.com/watch?v=RBs21CFBALI
      HostElementConstructor.observedAttributes = observedAttributes;

      // define the custom element
      win.customElements.define(tagName, HostElementConstructor);
    }
  }


  function isDefinedComponent(elm: Element) {
    // check if this component is already defined or not
    return globalDefined.indexOf(elm.tagName.toLowerCase()) > -1 || !!getComponentMeta(elm);
  }


  App.loadComponents = function loadComponents(bundleId, importFn) {
    // jsonp callback from requested bundles
    const args = arguments;

    // import component function
    // inject globals
    importFn(moduleImports, h, t, Context, publicPath);

    for (var i = 2; i < args.length; i++) {
      // parse the external component data into internal component meta data
      // then add our set of prototype methods to the component bundle
      parseComponentMeta(registry, moduleImports, args[i]);
    }

    // fire off all the callbacks waiting on this bundle to load
    var callbacks = bundleCallbacks[bundleId];
    if (callbacks) {
      for (i = 0; i < callbacks.length; i++) {
        callbacks[i]();
      }
      delete bundleCallbacks[bundleId];
    }

    // remember that we've already loaded this bundle
    loadedBundles[bundleId] = true;
  };


  App.loadStyles = function loadStyles() {
    // jsonp callback from requested bundles
    // either directly add styles to document.head or add the
    // styles to a template tag to be cloned later for shadow roots
    const args = arguments;
    let sElm: Element;
    let cmpMeta: ComponentMeta;

    for (var i = 0; i < args.length; i += 2) {
      cmpMeta = registry[args[i]];

      if (cmpMeta) {
        if (useShadowDom(supportsNativeShadowDom, cmpMeta)) {
          // this component SHOULD use shadow dom
          // and this browser DOES support shadow dom
          // these styles will be encapsulated to its shadow root

          // create the template element which will hold the styles
          // adding it to the dom via <template> so that we can
          // clone this for each shadow root that will need these styles
          styleTemplates[args[i]] = sElm = domApi.$createElement('template');

          // add the style text to the template element
          sElm.innerHTML = '<style>' + args[i + 1] + '</style>';

        } else {
          // either this component should NOT use shadow dom
          // or the browser does NOT support shadow dom
          // these styles go be applied to the global document
          sElm = domApi.$createElement('style');

          // add the style text to the style element
          sElm.innerHTML = args[i + 1];
        }

        // give it an unique id
        sElm.id = `style-${args[i]}`;

        // add our new element to the head
        domApi.$appendChild(domApi.$head, sElm);
      }
    }
  };


  function loadBundle(cmpMeta: ComponentMeta, elm: HostElement, cb: Function): void {
    const bundleId = getBundleId(supportsNativeShadowDom, cmpMeta, elm.mode);

    if (loadedBundles[bundleId]) {
      // sweet, we've already loaded this bundle
      cb();

    } else {
      // never seen this bundle before, let's start the request
      // and add it to the callbacks to fire when it has loaded
      (bundleCallbacks[bundleId] = bundleCallbacks[bundleId] || []).push(cb);

      // figure out which bundle to request and kick it off
      requestBundle(bundleId);
    }
  }


  function requestBundle(bundleId: string) {
    // create the url we'll be requesting
    const url = publicPath + bundleId + '.js';

    if (pendingBundleRequests[url]) {
      // we're already actively requesting this url
      // no need to do another request
      return;
    }

    // let's kick off the bundle request
    // remember that we're now actively requesting this url
    pendingBundleRequests[url] = true;

    // create a sript element to add to the document.head
    var scriptElm = domApi.$createElement('script');
    scriptElm.charset = 'utf-8';
    scriptElm.async = true;
    scriptElm.src = url;

    // create a fallback timeout if something goes wrong
    var tmrId = setTimeout(onScriptComplete, 120000);

    function onScriptComplete() {
      clearTimeout(tmrId);
      scriptElm.onerror = scriptElm.onload = null;
      domApi.$removeChild(scriptElm.parentNode, scriptElm);

      // remove from our list of active requests
      delete pendingBundleRequests[url];
    }

    // add script completed listener to this script element
    scriptElm.onerror = scriptElm.onload = onScriptComplete;

    // inject a script tag in the head
    // kick off the actual request
    domApi.$appendChild(domApi.$head, scriptElm);
  }

  function cloneComponentStyle(tag: string) {
    const templateElm = styleTemplates[tag];
    return templateElm && templateElm.content.cloneNode(true) as HTMLStyleElement;
  }

  var WindowCustomEvent = (win as any).CustomEvent;
  if (typeof WindowCustomEvent !== 'function') {
    // CustomEvent polyfill
    WindowCustomEvent = function CustomEvent(event: any, data: EventEmitterData) {
      var evt = domApi.$createEvent();
      evt.initCustomEvent(event, data.bubbles, data.cancelable, data.detail);
      return evt;
    };
    WindowCustomEvent.prototype = (win as any).Event.prototype;
  }

  // test if this browser supports event options or not
  var supportsEventOptions = false;
  try {
    win.addEventListener('eopt', null,
      Object.defineProperty({}, 'passive', {
        get: () => {
          supportsEventOptions = true;
        }
      })
    );
  } catch (e) {}

  function getEventOptions(useCapture: boolean, usePassive: boolean) {
    return supportsEventOptions ? {
        capture: !!useCapture,
        passive: !!usePassive
      } : !!useCapture;
  }

  function onError(type: number, err: any, elm: HostElement) {
    console.error(type, err, elm.tagName);
  }

  function propConnect(ctrlTag: string) {
    return proxyController(domApi, controllerComponents, ctrlTag);
  }

  function getContextItem(contextKey: string) {
    return Context[contextKey];
  }

  return plt;
}


export interface StyleTemplates {
  [tag: string]: HTMLTemplateElement;
}
