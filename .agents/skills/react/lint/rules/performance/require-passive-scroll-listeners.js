import { getPropertyName, unwrapExpression } from "../../utils.js";

const EVENTS = new Set(["touchstart", "touchmove", "touchend", "wheel", "mousewheel"]);

const message =
  "Add { passive: true } to touch and wheel listeners that do not call preventDefault. Skill: react -> references/performance/client-passive-event-listeners.md.";

function staticString(node) {
  const expr = unwrapExpression(node);
  if (expr?.type === "Literal" || expr?.type === "StringLiteral") {
    return typeof expr.value === "string" ? expr.value : undefined;
  }
  return undefined;
}

function staticBoolean(node) {
  const expr = unwrapExpression(node);
  if (expr?.type === "Literal" || expr?.type === "BooleanLiteral") {
    return typeof expr.value === "boolean" ? expr.value : undefined;
  }
  return undefined;
}

function optionsNeedPassive(options) {
  if (!options) return true;
  const expr = unwrapExpression(options);
  if (!expr) return false;
  const bool = staticBoolean(expr);
  if (bool === false) return true;
  if (bool === true) return false;
  if (expr.type !== "ObjectExpression") return false;
  if (
    expr.properties.some(
      (property) =>
        property.type === "SpreadElement" ||
        property.type === "ExperimentalSpreadProperty" ||
        (property.computed &&
          property.key?.type !== "Literal" &&
          property.key?.type !== "StringLiteral"),
    )
  ) {
    return false;
  }
  return !expr.properties.some((property) => {
    if (property.type !== "Property") return false;
    if (getPropertyName(property.key) !== "passive") return false;
    return staticBoolean(property.value) === true;
  });
}

function callsPreventDefault(node, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return false;
  seen.add(node);
  if (node.type === "CallExpression") {
    const callee = unwrapExpression(node.callee);
    if (
      callee?.type === "MemberExpression" &&
      getPropertyName(callee.property) === "preventDefault"
    ) {
      return true;
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === "parent" || !child || typeof child !== "object") continue;
    if (Array.isArray(child)) {
      if (child.some((item) => item?.type && callsPreventDefault(item, seen))) return true;
    } else if (child.type && callsPreventDefault(child, seen)) {
      return true;
    }
  }
  return false;
}

function asFunction(node) {
  const expr = unwrapExpression(node);
  if (
    expr?.type === "ArrowFunctionExpression" ||
    expr?.type === "FunctionExpression" ||
    expr?.type === "FunctionDeclaration"
  ) {
    return expr;
  }
  return undefined;
}

function resolveLocalFunction(context, node) {
  const fn = asFunction(node);
  if (fn) return fn;
  const ident = unwrapExpression(node);
  if (ident?.type !== "Identifier") return undefined;
  const sourceCode = context.sourceCode ?? context.getSourceCode?.();
  let scope = sourceCode?.getScope?.(ident) ?? context.getScope?.();
  while (scope) {
    const variable = scope.variables.find((entry) => entry.name === ident.name);
    if (variable?.defs?.length) {
      const def = variable.defs[0];
      if (def.type === "FunctionName") return asFunction(def.node);
      if (def.node?.type === "VariableDeclarator") return asFunction(def.node.init);
      return undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require passive: true on touch and wheel listeners that do not preventDefault.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.type !== "MemberExpression") return;
        if (getPropertyName(node.callee.property) !== "addEventListener") return;
        const event = staticString(node.arguments[0]);
        if (!event || !EVENTS.has(event)) return;
        if (!optionsNeedPassive(node.arguments[2])) return;
        const local = resolveLocalFunction(context, node.arguments[1]);
        if (local && callsPreventDefault(local)) return;
        context.report({ node, message });
      },
    };
  },
};
