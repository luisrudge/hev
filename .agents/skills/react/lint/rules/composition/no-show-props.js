import { getPropertyName } from "../../utils.js";

const SHOW_PROP = /^show[A-Z]/;
const PROPS_TYPE = /Props$/;
const COMPONENT = /^[A-Z]/;

const message =
  "Do not add showX boolean props; compose the pieces instead. Skill: react -> references/composition/architecture-avoid-boolean-props.md.";

function isShowProp(name) {
  return typeof name === "string" && SHOW_PROP.test(name);
}

function isCustomComponent(name) {
  if (!name) return false;
  if (name.type === "JSXMemberExpression") return true;
  if (name.type === "JSXIdentifier") return COMPONENT.test(name.name);
  return false;
}

function reportObjectPattern(pattern, context) {
  if (pattern?.type !== "ObjectPattern") return;
  for (const property of pattern.properties) {
    if (property.type !== "Property") continue;
    const name = getPropertyName(property.key);
    if (isShowProp(name)) context.report({ node: property.key, message });
  }
}

function reportFunctionParams(fn, context) {
  for (const param of fn.params ?? []) reportObjectPattern(param, context);
}

function isPropsTypeName(id) {
  return id?.type === "Identifier" && PROPS_TYPE.test(id.name);
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow showX props; compose instead." },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = getPropertyName(node.name);
        if (!isShowProp(name)) return;
        const element = node.parent;
        if (element?.type !== "JSXOpeningElement" || !isCustomComponent(element.name)) return;
        context.report({ node, message });
      },
      TSPropertySignature(node) {
        const name = getPropertyName(node.key);
        if (!isShowProp(name)) return;
        let current = node.parent;
        while (current && current.type !== "TSTypeLiteral" && current.type !== "TSInterfaceBody") {
          current = current.parent;
        }
        const owner = current?.parent;
        if (owner?.type === "TSInterfaceDeclaration" && isPropsTypeName(owner.id)) {
          context.report({ node, message });
          return;
        }
        if (owner?.type === "TSTypeAliasDeclaration" && isPropsTypeName(owner.id)) {
          context.report({ node, message });
        }
      },
      FunctionDeclaration(node) {
        if (!node.id || !COMPONENT.test(node.id.name)) return;
        reportFunctionParams(node, context);
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier" || !COMPONENT.test(node.id.name)) return;
        const init = node.init;
        if (init?.type !== "ArrowFunctionExpression" && init?.type !== "FunctionExpression") return;
        reportFunctionParams(init, context);
      },
    };
  },
};
