import {
  getJSXAttribute,
  getJSXAttributeExpression,
  hasJSXSpread,
  isViewTransition,
  unwrapExpression,
} from "../../utils.js";

const message =
  "Pair type-map enter and exit as objects. A one-sided type map drops the opposite page animation. Skill: react -> references/view-transitions/implementation.md.";

function isObjectExpression(node) {
  const expr = unwrapExpression(node);
  return expr?.type === "ObjectExpression";
}

function isStaticString(node) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if (expr.type === "Literal" || expr.type === "StringLiteral") {
    return typeof expr.value === "string";
  }
  if (expr.type === "TemplateLiteral") return expr.expressions.length === 0;
  return false;
}

function attrKind(attribute) {
  if (!attribute) return "missing";
  const expr = getJSXAttributeExpression(attribute);
  if (!expr) return "missing";
  if (isObjectExpression(expr)) return "object";
  if (isStaticString(expr)) return "string";
  return "dynamic";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require type-map enter and exit to be paired object expressions.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isViewTransition(node)) return;

        const enterAttr = getJSXAttribute(node, "enter");
        const exitAttr = getJSXAttribute(node, "exit");
        const enter = attrKind(enterAttr);
        const exit = attrKind(exitAttr);
        const spread = hasJSXSpread(node);

        if (enter === "object") {
          if (exit === "object") return;
          if (exit === "dynamic") return;
          if (exit === "missing" && spread) return;
          context.report({ node: enterAttr, message });
          return;
        }

        if (exit === "object") {
          if (enter === "object") return;
          if (enter === "dynamic") return;
          if (enter === "missing" && spread) return;
          context.report({ node: exitAttr, message });
        }
      },
    };
  },
};
