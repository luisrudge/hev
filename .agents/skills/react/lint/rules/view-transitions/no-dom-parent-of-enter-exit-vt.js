import { getJSXAttribute, getJSXName, isViewTransition } from "../../utils.js";

const message =
  "Don't wrap <ViewTransition enter/exit> in a DOM element — enter/exit only activate when the VT appears before any DOM nodes. Skill: react -> references/view-transitions/index.md.";

function isIntrinsicDomName(name) {
  return Boolean(name) && !name.includes(".") && name === name.toLowerCase();
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow intrinsic DOM parents of ViewTransition when enter or exit is set.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isViewTransition(node)) return;
        const opening = node.openingElement;
        if (!getJSXAttribute(opening, "enter") && !getJSXAttribute(opening, "exit")) return;

        const parent = node.parent;
        if (parent?.type !== "JSXElement") return;
        const parentName = getJSXName(parent.openingElement?.name);
        if (!isIntrinsicDomName(parentName)) return;

        context.report({ node, message });
      },
    };
  },
};
