import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "Do not call document.startViewTransition. Let React's <ViewTransition> own the browser transition. Skill: react -> references/view-transitions/index.md.";

function isTestOrTooling(filename) {
  const normalized = String(filename).split("\\").join("/");
  return (
    /(\.|\/)(test|spec|e2e)\.[cm]?tsx?$/.test(normalized) ||
    /(^|\/)(tests?|e2e|__tests__)\//.test(normalized) ||
    /\.(config|setup)\.[cm]?[jt]sx?$/.test(normalized) ||
    /(^|\/)scripts\//.test(normalized)
  );
}

function findVariable(context, identifier) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.();
  let scope = sourceCode?.getScope?.(identifier) ?? context.getScope?.();
  while (scope) {
    const variable = scope.variables.find((entry) => entry.name === identifier.name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return undefined;
}

function isGlobalIdentifier(context, node, name) {
  const identifier = unwrapExpression(node);
  if (identifier?.type !== "Identifier" || identifier.name !== name) return false;
  const variable = findVariable(context, identifier);
  return !variable || variable.defs.length === 0;
}

function isGlobalDocument(context, node) {
  const expression = unwrapExpression(node);
  if (isGlobalIdentifier(context, expression, "document")) return true;
  if (
    expression?.type !== "MemberExpression" ||
    getPropertyName(expression.property) !== "document"
  ) {
    return false;
  }
  return isGlobalIdentifier(context, expression.object, "window");
}

function importedAliasName(property) {
  if (property.type !== "Property" || getPropertyName(property.key) !== "startViewTransition") {
    return undefined;
  }
  if (property.value?.type === "Identifier") return property.value.name;
  if (property.value?.type === "AssignmentPattern" && property.value.left?.type === "Identifier") {
    return property.value.left.name;
  }
  return undefined;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow calling document.startViewTransition; React owns that call.",
    },
  },
  create(context) {
    if (isTestOrTooling(context.filename)) return {};

    const aliasDefinitions = new Map();

    function isTrackedAlias(identifier) {
      const definitions = aliasDefinitions.get(identifier.name);
      if (!definitions) return false;
      const variable = findVariable(context, identifier);
      return variable?.defs.some((definition) => definitions.has(definition.node)) ?? false;
    }

    return {
      VariableDeclarator(node) {
        if (node.id?.type !== "ObjectPattern" || !isGlobalDocument(context, node.init)) return;
        for (const property of node.id.properties) {
          const name = importedAliasName(property);
          if (!name) continue;
          const definitions = aliasDefinitions.get(name) ?? new Set();
          definitions.add(node);
          aliasDefinitions.set(name, definitions);
        }
      },
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);
        if (callee?.type === "Identifier" && isTrackedAlias(callee)) {
          context.report({ node, message });
          return;
        }
        if (
          callee?.type === "MemberExpression" &&
          getPropertyName(callee.property) === "startViewTransition" &&
          isGlobalDocument(context, callee.object)
        ) {
          context.report({ node, message });
        }
      },
    };
  },
};
