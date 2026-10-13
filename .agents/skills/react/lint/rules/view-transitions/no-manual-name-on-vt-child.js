import {
  getJSXAttribute,
  getJSXAttributeExpression,
  getPropertyName,
  isViewTransition,
} from "../../utils.js";

const message =
  "Don't set viewTransitionName on the root child of <ViewTransition>; React's auto-name overrides it. Skill: react -> references/view-transitions/patterns.md.";

function isIgnorableChild(child) {
  if (child.type === "JSXText") return child.value.trim() === "";
  if (child.type === "JSXEmptyExpression") return true;
  if (child.type === "JSXExpressionContainer") {
    const expr = child.expression;
    if (expr?.type === "JSXEmptyExpression") return true;
    if (
      (expr?.type === "Literal" || expr?.type === "StringLiteral") &&
      String(expr.value).trim() === ""
    ) {
      return true;
    }
  }
  return false;
}

function firstElementChild(node) {
  for (const child of node.children ?? []) {
    if (isIgnorableChild(child)) continue;
    if (child.type === "JSXElement") return child;
    return undefined;
  }
}

function isNameProperty(prop) {
  if (prop.type !== "Property" && prop.type !== "ObjectProperty") return false;
  if (prop.computed && prop.key?.type !== "Literal" && prop.key?.type !== "StringLiteral") {
    return false;
  }
  const name = getPropertyName(prop.key);
  return name === "viewTransitionName" || name === "view-transition-name";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow a manual view-transition name on the root child of ViewTransition.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isViewTransition(node)) return;
        const child = firstElementChild(node);
        if (!child) return;
        const style = getJSXAttribute(child.openingElement, "style");
        const value = getJSXAttributeExpression(style);
        if (!value || value.type !== "ObjectExpression") return;
        if (value.properties.some((prop) => prop.type === "SpreadElement")) return;
        for (const prop of value.properties) {
          if (isNameProperty(prop)) context.report({ node: prop, message });
        }
      },
    };
  },
};
