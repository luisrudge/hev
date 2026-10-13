import {
  getJSXAttribute,
  getJSXAttributeExpression,
  getPropertyName,
  isViewTransition,
  unwrapExpression,
} from "../../utils.js";

const PROPS = ["enter", "exit", "share", "update"];
const message =
  'Type maps on ViewTransition must include default: "none"; otherwise the fallback is "auto" and fires on every transition. Skill: react -> references/view-transitions/implementation.md.';

function isStaticNone(node) {
  const expr = unwrapExpression(node);
  if ((expr?.type === "Literal" || expr?.type === "StringLiteral") && expr.value === "none") {
    return true;
  }
  return (
    expr?.type === "TemplateLiteral" &&
    expr.expressions.length === 0 &&
    expr.quasis[0]?.value?.cooked === "none"
  );
}

function inspectTypeMap(object) {
  if (object.type !== "ObjectExpression") return "skip";
  let defaultProp;
  for (const property of object.properties) {
    if (property.type === "SpreadElement" || property.type === "ExperimentalSpreadProperty") {
      return "skip";
    }
    if (property.type !== "Property" && property.type !== "ObjectProperty") return "skip";
    if (property.computed && getPropertyName(property.key) === undefined) return "skip";
    if (getPropertyName(property.key) === "default") defaultProp = property;
  }
  if (!defaultProp) return "report";
  if (!isStaticNone(defaultProp.value)) return "report";
  return "ok";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: 'Require ViewTransition type maps to set default: "none".',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isViewTransition(node)) return;
        for (const name of PROPS) {
          const attribute = getJSXAttribute(node, name);
          if (!attribute) continue;
          const value = getJSXAttributeExpression(attribute);
          if (!value || inspectTypeMap(value) !== "report") continue;
          context.report({ node: attribute, message });
        }
      },
    };
  },
};
