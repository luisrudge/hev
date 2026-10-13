const message =
  "Use use() instead of useContext() in React 19. Skill: react -> references/composition/react19-no-forwardref.md.";

function importedName(spec) {
  const imported = spec.imported;
  if (!imported) return undefined;
  return imported.name ?? imported.value;
}

function resolvesTo(context, identifier, definitions) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.();
  let scope = sourceCode?.getScope?.(identifier) ?? context.getScope?.();
  while (scope) {
    const variable = scope.variables.find((entry) => entry.name === identifier.name);
    if (variable) {
      return variable.defs.some((definition) => definitions.has(definition.node));
    }
    scope = scope.upper;
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow React useContext; use use() instead." },
  },
  create(context) {
    const reactNs = new Set();
    const namespaceDefinitions = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "react") return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
            reactNs.add(spec.local.name);
            namespaceDefinitions.add(spec);
            continue;
          }
          if (spec.type === "ImportSpecifier" && importedName(spec) === "useContext") {
            context.report({ node: spec, message });
          }
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          reactNs.has(callee.object.name) &&
          resolvesTo(context, callee.object, namespaceDefinitions) &&
          (callee.property.name ?? callee.property.value) === "useContext"
        ) {
          context.report({ node: callee, message });
        }
      },
    };
  },
};
