import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "Use a functional setState updater when the next value depends on the current state. Skill: react -> references/performance/rerender-functional-setstate.md.";

function collectBindingNames(pattern, into) {
  if (!pattern) return;
  if (pattern.type === "Identifier") {
    into.add(pattern.name);
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    collectBindingNames(pattern.left, into);
    return;
  }
  if (pattern.type === "RestElement") {
    collectBindingNames(pattern.argument, into);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) collectBindingNames(element, into);
    return;
  }
  if (pattern.type === "ObjectPattern") {
    for (const prop of pattern.properties) {
      collectBindingNames(prop.type === "RestElement" ? prop : prop.value, into);
    }
  }
}

function walkNodes(node, visit) {
  if (!node || typeof node !== "object") return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "range" || key === "loc" || key === "tokens") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walkNodes(child, visit);
    } else if (value && typeof value === "object" && value.type) {
      walkNodes(value, visit);
    }
  }
}

function referencesState(node, stateName, context, definitionNode) {
  let found = false;
  const isStateBinding = (identifier) =>
    findVariable(context, identifier)?.defs.some(
      (definition) => definition.node === definitionNode,
    ) ?? false;
  const visit = (current, shadowed) => {
    if (found || !current || typeof current !== "object") return;
    if (
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration"
    ) {
      const next = new Set(shadowed);
      if (current.id?.name) next.add(current.id.name);
      for (const param of current.params) collectBindingNames(param, next);
      walkNodes(current.body ?? current, (child) => {
        if (child === current) return;
        if (
          child.type === "FunctionExpression" ||
          child.type === "ArrowFunctionExpression" ||
          child.type === "FunctionDeclaration"
        ) {
          visit(child, next);
          return false;
        }
        if (child.type === "Identifier") {
          if (child.name === stateName && !next.has(stateName) && isStateBinding(child))
            found = true;
          return false;
        }
        if (child.type === "MemberExpression" && !child.computed) {
          visit(child.object, next);
          return false;
        }
        if ((child.type === "Property" || child.type === "PropertyDefinition") && !child.computed) {
          visit(child.value, next);
          return false;
        }
      });
      return;
    }
    walkNodes(current, (child) => {
      if (
        child.type === "FunctionExpression" ||
        child.type === "ArrowFunctionExpression" ||
        child.type === "FunctionDeclaration"
      ) {
        visit(child, shadowed);
        return false;
      }
      if (child.type === "Identifier") {
        if (child.name === stateName && !shadowed.has(stateName) && isStateBinding(child))
          found = true;
        return false;
      }
      if (child.type === "MemberExpression" && !child.computed) {
        visit(child.object, shadowed);
        return false;
      }
      if ((child.type === "Property" || child.type === "PropertyDefinition") && !child.computed) {
        visit(child.value, shadowed);
        return false;
      }
    });
  };
  visit(node, new Set());
  return found;
}

function arrayPatternIds(id) {
  if (id?.type !== "ArrayPattern" || id.elements.length < 2) return undefined;
  const state = id.elements[0];
  const setter = id.elements[1];
  if (state?.type !== "Identifier" || setter?.type !== "Identifier") return undefined;
  return { state: state.name, setter: setter.name };
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

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require functional setState when the update depends on current state.",
    },
  },
  create(context) {
    const useStateNames = new Set();
    const reactNamespaces = new Set();
    const definitionNodes = new Set();
    const functionStack = [];
    const pairsByFunction = new WeakMap();

    function currentPairs() {
      const fn = functionStack.at(-1);
      if (!fn) return undefined;
      let pairs = pairsByFunction.get(fn);
      if (!pairs) {
        pairs = new Map();
        pairsByFunction.set(fn, pairs);
      }
      return pairs;
    }

    function isTracked(identifier) {
      const variable = findVariable(context, identifier);
      return variable?.defs.some((definition) => definitionNodes.has(definition.node)) ?? false;
    }

    function isUseStateCallee(node) {
      const callee = unwrapExpression(node);
      if (!callee) return false;
      if (callee.type === "Identifier") {
        return useStateNames.has(callee.name) && isTracked(callee);
      }
      if (callee.type === "MemberExpression" && !callee.computed) {
        const object = unwrapExpression(callee.object);
        return (
          getPropertyName(callee.property) === "useState" &&
          object?.type === "Identifier" &&
          reactNamespaces.has(object.name) &&
          isTracked(object)
        );
      }
      return false;
    }

    function findPair(setter) {
      const variable = findVariable(context, setter);
      for (let index = functionStack.length - 1; index >= 0; index -= 1) {
        const pair = pairsByFunction.get(functionStack[index])?.get(setter.name);
        if (pair && variable?.defs.some((definition) => definition.node === pair.definition)) {
          return pair;
        }
      }
      return undefined;
    }

    const enterFunction = (node) => functionStack.push(node);
    const exitFunction = () => functionStack.pop();

    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "react" && node.source?.value !== "react/index") return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" && getPropertyName(spec.imported) === "useState") {
            useStateNames.add(spec.local.name);
            definitionNodes.add(spec);
          } else if (
            spec.type === "ImportDefaultSpecifier" ||
            spec.type === "ImportNamespaceSpecifier"
          ) {
            reactNamespaces.add(spec.local.name);
            definitionNodes.add(spec);
          }
        }
      },
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      VariableDeclarator(node) {
        const pairs = currentPairs();
        if (!pairs) return;
        const names = arrayPatternIds(node.id);
        const init = unwrapExpression(node.init);
        if (!names || init?.type !== "CallExpression" || !isUseStateCallee(init.callee)) return;
        pairs.set(names.setter, {
          state: names.state,
          definition: node,
        });
      },
      CallExpression(node) {
        if (node.arguments.length !== 1) return;
        const callee = unwrapExpression(node.callee);
        if (callee?.type !== "Identifier") return;
        const pair = findPair(callee);
        if (!pair) return;
        const arg = unwrapExpression(node.arguments[0]);
        if (!arg) return;
        if (arg.type === "ArrowFunctionExpression" || arg.type === "FunctionExpression") return;
        if (!referencesState(arg, pair.state, context, pair.definition)) return;
        context.report({ node, message });
      },
    };
  },
};

export default rule;
