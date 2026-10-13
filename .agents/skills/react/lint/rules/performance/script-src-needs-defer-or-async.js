import { getJSXAttribute, getJSXAttributeExpression, getJSXName } from "../../utils.js";

const message =
  'Scripts with src block HTML parsing unless they use async, defer, or type="module". Skill: react -> references/performance/rendering-script-defer-async.md.';

function isPresentBoolean(attribute) {
  if (!attribute) return false;
  if (attribute.value == null) return true;
  const expr = getJSXAttributeExpression(attribute);
  return expr?.type === "Literal" && expr.value === true;
}

function isModuleType(attribute) {
  if (!attribute) return false;
  const expr = getJSXAttributeExpression(attribute);
  return (
    (expr?.type === "Literal" || expr?.type === "StringLiteral") &&
    String(expr.value).toLowerCase() === "module"
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require async, defer, or type=module on script tags with src.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (getJSXName(node.name) !== "script") return;
        if (node.attributes?.some((attribute) => attribute.type === "JSXSpreadAttribute")) return;
        if (!getJSXAttribute(node, "src")) return;
        if (isPresentBoolean(getJSXAttribute(node, "async"))) return;
        if (isPresentBoolean(getJSXAttribute(node, "defer"))) return;
        if (isModuleType(getJSXAttribute(node, "type"))) return;
        context.report({ node, message });
      },
    };
  },
};
