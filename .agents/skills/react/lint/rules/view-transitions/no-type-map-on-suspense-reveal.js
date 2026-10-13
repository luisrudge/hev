import {
  getJSXAttributeExpression,
  getJSXName,
  getPropertyName,
  isViewTransition,
} from "../../utils.js";

const TYPE_MAP_PROPS = new Set(["enter", "exit", "share"]);

const message =
  "Type maps on enter/exit/share cannot match Suspense reveal triggers (those transitions have no type). Use a string class name. Skill: react -> references/view-transitions/implementation.md.";

function isSuspenseName(name) {
  return name === "Suspense" || name === "React.Suspense";
}

function isObjectTypeMap(attribute) {
  if (attribute.type !== "JSXAttribute") return false;
  if (!TYPE_MAP_PROPS.has(getPropertyName(attribute.name))) return false;
  return getJSXAttributeExpression(attribute)?.type === "ObjectExpression";
}

function skipFragments(element) {
  let current = element;
  while (current.parent?.type === "JSXFragment") current = current.parent;
  return current;
}

function isSuspenseFallbackValue(element) {
  let node = skipFragments(element).parent;
  if (node?.type === "JSXExpressionContainer") node = node.parent;
  if (node?.type !== "JSXAttribute" || getPropertyName(node.name) !== "fallback") return false;
  return isSuspenseName(getJSXName(node.parent?.name));
}

function isDirectSuspenseChild(element) {
  const parent = skipFragments(element).parent;
  if (parent?.type !== "JSXElement") return false;
  return isSuspenseName(getJSXName(parent.openingElement?.name));
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow object type maps on ViewTransition enter/exit/share used as a Suspense reveal.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isViewTransition(node)) return;
        if (!isSuspenseFallbackValue(node) && !isDirectSuspenseChild(node)) return;
        for (const attribute of node.openingElement.attributes) {
          if (!isObjectTypeMap(attribute)) continue;
          context.report({ node: attribute, message });
        }
      },
    };
  },
};
