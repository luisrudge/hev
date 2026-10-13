import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "router.back(), history.back(), and navigate(-1) drop transition types, so type-keyed view transitions fall back to default. Navigate to an explicit URL with addTransitionType instead. Skill: react -> references/view-transitions/implementation.md.";

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function isReactModule(value) {
  return value === "react";
}

function isMinusOne(node) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if ((expr.type === "Literal" || expr.type === "NumericLiteral") && expr.value === -1) return true;
  return (
    expr.type === "UnaryExpression" &&
    expr.operator === "-" &&
    (expr.argument?.type === "Literal" || expr.argument?.type === "NumericLiteral") &&
    expr.argument.value === 1
  );
}

function isBackCall(node) {
  const callee = unwrapExpression(node.callee);
  if (callee?.type !== "MemberExpression" || getPropertyName(callee.property) !== "back") {
    return false;
  }
  const object = unwrapExpression(callee.object);
  return (
    (object?.type === "Identifier" && (object.name === "router" || object.name === "history")) ||
    (object?.type === "MemberExpression" && getPropertyName(object.property) === "history")
  );
}

function isNavigateBack(node) {
  const callee = unwrapExpression(node.callee);
  return (
    callee?.type === "Identifier" && callee.name === "navigate" && isMinusOne(node.arguments[0])
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow addTransitionType in the same function as router/history back or navigate(-1).",
    },
  },
  create(context) {
    const addTypeLocals = new Set();
    const reactNamespaces = new Set();
    const typedOwners = new Set();
    const backCalls = [];
    const stack = [];

    function owner() {
      return stack.at(-1) ?? null;
    }

    function isTrackedAddTransitionType(callee) {
      const expr = unwrapExpression(callee);
      if (expr?.type === "Identifier") return addTypeLocals.has(expr.name);
      if (expr?.type !== "MemberExpression") return false;
      if (getPropertyName(expr.property) !== "addTransitionType") return false;
      const object = unwrapExpression(expr.object);
      return object?.type === "Identifier" && reactNamespaces.has(object.name);
    }

    const enterFunction = (node) => stack.push(node);
    const exitFunction = () => stack.pop();

    return {
      ImportDeclaration(node) {
        if (!isReactModule(node.source?.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            const imported = specifier.imported;
            const importedName = imported.name ?? imported.value;
            if (importedName === "addTransitionType") addTypeLocals.add(specifier.local.name);
          } else if (
            specifier.type === "ImportNamespaceSpecifier" ||
            specifier.type === "ImportDefaultSpecifier"
          ) {
            reactNamespaces.add(specifier.local.name);
          }
        }
      },
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node) {
        if (isTrackedAddTransitionType(node.callee)) {
          const current = owner();
          if (current && FUNCTION_TYPES.has(current.type)) typedOwners.add(current);
          return;
        }
        if (isBackCall(node) || isNavigateBack(node)) backCalls.push({ node, owner: owner() });
      },
      "Program:exit"() {
        for (const call of backCalls) {
          if (call.owner && typedOwners.has(call.owner))
            context.report({ node: call.node, message });
        }
      },
    };
  },
};
