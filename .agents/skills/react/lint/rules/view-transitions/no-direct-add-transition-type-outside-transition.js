import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "Call addTransitionType inside startTransition or a useTransition starter. Skill: react -> references/view-transitions/index.md.";

function importedName(spec) {
  const imported = spec.imported;
  if (!imported) return undefined;
  return imported.name ?? imported.value;
}

function isFunction(node) {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionExpression" ||
    node?.type === "FunctionDeclaration"
  );
}

function isNamedHelper(fn) {
  if (fn.type === "FunctionDeclaration") return true;
  if (fn.type === "FunctionExpression" && fn.id) return true;
  return fn.parent?.type === "VariableDeclarator" && fn.parent.init === fn;
}

function isJsxEventHandler(fn) {
  const parent = fn.parent;
  if (parent?.type !== "JSXExpressionContainer") return false;
  const attribute = parent.parent;
  if (attribute?.type !== "JSXAttribute") return false;
  const name = getPropertyName(attribute.name);
  return typeof name === "string" && /^on[A-Z]/.test(name);
}

function calleeName(callee, locals, reactNs, memberName, isTracked) {
  const node = unwrapExpression(callee);
  if (!node) return false;
  if (node.type === "Identifier") return locals.has(node.name) && isTracked(node);
  if (node.type !== "MemberExpression" || node.optional) return false;
  const object = unwrapExpression(node.object);
  return (
    object?.type === "Identifier" &&
    reactNs.has(object.name) &&
    isTracked(object) &&
    getPropertyName(node.property) === memberName
  );
}

function isCallArg(fn, predicate) {
  const call = fn.parent;
  if (call?.type !== "CallExpression") return false;
  if (!predicate(call.callee)) return false;
  return call.arguments.includes(fn);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow addTransitionType in inline JSX handlers outside a transition.",
    },
  },
  create(context) {
    const reactNs = new Set();
    const addLocals = new Set();
    const startLocals = new Set();
    const useTransitionLocals = new Set();
    const definitionNodes = new Set();

    const isTracked = (identifier) => {
      const sourceCode = context.sourceCode ?? context.getSourceCode?.();
      let scope = sourceCode?.getScope?.(identifier) ?? context.getScope?.();
      while (scope) {
        const variable = scope.variables.find((entry) => entry.name === identifier.name);
        if (variable)
          return variable.defs.some((definition) => definitionNodes.has(definition.node));
        scope = scope.upper;
      }
      return true;
    };
    const isStart = (callee) =>
      calleeName(callee, startLocals, reactNs, "startTransition", isTracked);
    const isUseTransition = (callee) =>
      calleeName(callee, useTransitionLocals, reactNs, "useTransition", isTracked);
    const isAdd = (callee) =>
      calleeName(callee, addLocals, reactNs, "addTransitionType", isTracked);

    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "react") return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
            reactNs.add(spec.local.name);
            definitionNodes.add(spec);
            continue;
          }
          if (spec.type !== "ImportSpecifier") continue;
          const name = importedName(spec);
          if (name === "addTransitionType") addLocals.add(spec.local.name);
          if (name === "startTransition") startLocals.add(spec.local.name);
          if (name === "useTransition") useTransitionLocals.add(spec.local.name);
          if (
            name === "addTransitionType" ||
            name === "startTransition" ||
            name === "useTransition"
          ) {
            definitionNodes.add(spec);
          }
        }
      },
      VariableDeclarator(node) {
        const init = unwrapExpression(node.init);
        if (init?.type !== "CallExpression" || !isUseTransition(init.callee)) return;
        const id = node.id;
        if (id?.type !== "ArrayPattern" || id.elements.length < 2) return;
        const starter = id.elements[1];
        if (starter?.type === "Identifier") {
          startLocals.add(starter.name);
          definitionNodes.add(node);
        }
      },
      CallExpression(node) {
        if (!isAdd(node.callee)) return;

        for (let current = node.parent; current; current = current.parent) {
          if (!isFunction(current)) continue;
          if (isCallArg(current, isStart)) return;
          if (isNamedHelper(current)) return;
          if (isJsxEventHandler(current)) {
            context.report({ node, message });
            return;
          }
        }
      },
    };
  },
};
