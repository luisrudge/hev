import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "Use <Context value> instead of <Context.Provider> in React 19. Skill: react -> references/composition/react19-no-forwardref.md.";

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

function isCreateContextCall(context, init, createContextLocals, reactNs, definitions) {
  const expr = unwrapExpression(init);
  if (!expr || expr.type !== "CallExpression") return false;
  const callee = expr.callee;
  if (callee.type === "Identifier") {
    return createContextLocals.has(callee.name) && resolvesTo(context, callee, definitions);
  }
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    reactNs.has(callee.object.name) &&
    resolvesTo(context, callee.object, definitions) &&
    getPropertyName(callee.property) === "createContext"
  );
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow Context.Provider; pass value on the context in React 19." },
  },
  create(context) {
    const reactNs = new Set();
    const createContextLocals = new Set();
    const reactDefinitions = new Set();
    const contextBindings = new Map();

    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "react") return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
            reactNs.add(spec.local.name);
            reactDefinitions.add(spec);
            continue;
          }
          if (spec.type === "ImportSpecifier" && importedName(spec) === "createContext") {
            createContextLocals.add(spec.local.name);
            reactDefinitions.add(spec);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier") return;
        if (
          isCreateContextCall(context, node.init, createContextLocals, reactNs, reactDefinitions)
        ) {
          const definitions = contextBindings.get(node.id.name) ?? new Set();
          definitions.add(node);
          contextBindings.set(node.id.name, definitions);
        }
      },
      JSXOpeningElement(node) {
        const name = node.name;
        if (name?.type !== "JSXMemberExpression") return;
        if (getPropertyName(name.property) !== "Provider") return;
        const object = name.object;
        if (object.type !== "JSXIdentifier") return;
        const id = object.name;
        const definitions = contextBindings.get(id);
        if ((definitions && resolvesTo(context, object, definitions)) || id.endsWith("Context")) {
          context.report({ node: name, message });
        }
      },
    };
  },
};
