import namedComponentProps from "./rules/composition/named-component-props.js";
import namedFunctionArgs from "./rules/composition/named-function-args.js";
import noContextProvider from "./rules/composition/no-context-provider.js";
import noForwardRef from "./rules/composition/no-forward-ref.js";
import noShowProps from "./rules/composition/no-show-props.js";
import noUseContext from "./rules/composition/no-use-context.js";
import hoistStaticRegexp from "./rules/performance/hoist-static-regexp.js";
import jsxNoLeakedAnd from "./rules/performance/jsx-no-leaked-and.js";
import noReactHooksSuppressionComments from "./rules/performance/no-react-hooks-suppression-comments.js";
import preferFunctionalSetstate from "./rules/performance/prefer-functional-setstate.js";
import requirePassiveScrollListeners from "./rules/performance/require-passive-scroll-listeners.js";
import scriptSrcNeedsDeferOrAsync from "./rules/performance/script-src-needs-defer-or-async.js";
import useStateLazyInit from "./rules/performance/use-state-lazy-init.js";
import noDirectAddTransitionTypeOutsideTransition from "./rules/view-transitions/no-direct-add-transition-type-outside-transition.js";
import noDocumentStartViewTransition from "./rules/view-transitions/no-document-start-view-transition.js";
import noDomParentOfEnterExitVt from "./rules/view-transitions/no-dom-parent-of-enter-exit-vt.js";
import noManualNameOnVtChild from "./rules/view-transitions/no-manual-name-on-vt-child.js";
import noTypeMapOnSuspenseReveal from "./rules/view-transitions/no-type-map-on-suspense-reveal.js";
import noTypedRouterBack from "./rules/view-transitions/no-typed-router-back.js";
import requireDefaultNoneOnTypeKeyedVt from "./rules/view-transitions/require-default-none-on-type-keyed-vt.js";
import requirePairedTypeMapEnterExit from "./rules/view-transitions/require-paired-type-map-enter-exit.js";
import requireTypeMapDefaultNone from "./rules/view-transitions/require-type-map-default-none.js";

export default {
  meta: { name: "react-skill" },
  rules: {
    "hoist-static-regexp": hoistStaticRegexp,
    "jsx-no-leaked-and": jsxNoLeakedAnd,
    "named-component-props": namedComponentProps,
    "named-function-args": namedFunctionArgs,
    "no-context-provider": noContextProvider,
    "no-direct-add-transition-type-outside-transition": noDirectAddTransitionTypeOutsideTransition,
    "no-document-start-view-transition": noDocumentStartViewTransition,
    "no-dom-parent-of-enter-exit-vt": noDomParentOfEnterExitVt,
    "no-forward-ref": noForwardRef,
    "no-manual-name-on-vt-child": noManualNameOnVtChild,
    "no-react-hooks-suppression-comments": noReactHooksSuppressionComments,
    "no-show-props": noShowProps,
    "no-type-map-on-suspense-reveal": noTypeMapOnSuspenseReveal,
    "no-typed-router-back": noTypedRouterBack,
    "no-use-context": noUseContext,
    "prefer-functional-setstate": preferFunctionalSetstate,
    "require-default-none-on-type-keyed-vt": requireDefaultNoneOnTypeKeyedVt,
    "require-paired-type-map-enter-exit": requirePairedTypeMapEnterExit,
    "require-passive-scroll-listeners": requirePassiveScrollListeners,
    "require-type-map-default-none": requireTypeMapDefaultNone,
    "script-src-needs-defer-or-async": scriptSrcNeedsDeferOrAsync,
    "use-state-lazy-init": useStateLazyInit,
  },
};
