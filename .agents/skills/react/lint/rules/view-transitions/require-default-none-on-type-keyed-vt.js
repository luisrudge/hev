import {
  getJSXAttribute,
  getJSXAttributeExpression,
  getPropertyName,
  hasJSXSpread,
  isViewTransition,
  unwrapExpression,
} from "../../utils.js";

const TRIGGERS = new Set(["enter", "exit", "share", "update"]);

const message =
  'Type-keyed ViewTransition must set default="none" on the component. Skill: react -> references/view-transitions/implementation.md.';

function staticString(node) {
  const expr = unwrapExpression(node);
  if (!expr) return undefined;
  if (expr.type === "Literal" || expr.type === "StringLiteral") {
    return typeof expr.value === "string" ? expr.value : undefined;
  }
  if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
    return expr.quasis[0]?.value?.cooked;
  }
  return undefined;
}

function isObjectExpression(node) {
  return unwrapExpression(node)?.type === "ObjectExpression";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: 'Require default="none" on ViewTransition with type-keyed trigger maps.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isViewTransition(node) || hasJSXSpread(node)) return;

        const triggers = node.attributes.filter(
          (attribute) =>
            attribute.type === "JSXAttribute" && TRIGGERS.has(getPropertyName(attribute.name)),
        );
        if (triggers.length === 0) return;

        let hasObjectTrigger = false;
        for (const attribute of triggers) {
          const expr = getJSXAttributeExpression(attribute);
          if (isObjectExpression(expr)) {
            hasObjectTrigger = true;
          } else if (staticString(expr) === undefined) {
            return;
          }
        }
        if (!hasObjectTrigger) return;

        const defaultAttr = getJSXAttribute(node, "default");
        if (staticString(getJSXAttributeExpression(defaultAttr)) !== "none") {
          context.report({ node, message });
        }
      },
    };
  },
};
