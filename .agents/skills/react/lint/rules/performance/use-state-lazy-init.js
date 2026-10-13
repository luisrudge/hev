import { getPropertyName, unwrapExpression } from "../../utils.js";

const message =
  "Pass a function to useState for expensive initial values so the work runs once. Skill: react -> references/performance/rerender-lazy-state-init.md.";

const EXPENSIVE_PREFIX = /^(build|create|compute|derive|parse|read|load)/i;
const EXPENSIVE_CALLEES = new Set(["structuredClone"]);
const CHEAP_BUILTINS = new Set(["parseFloat", "parseInt"]);
const EXPENSIVE_CTORS = new Set(["Map", "Set", "URL"]);

function calleeName(node) {
  const callee = unwrapExpression(node?.callee);
  if (!callee) return undefined;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") {
    return getPropertyName(callee.property);
  }
  return undefined;
}

function objectName(node) {
  const object = unwrapExpression(node);
  if (object?.type === "Identifier") return object.name;
  return undefined;
}

function isExpensiveCall(node) {
  const callee = unwrapExpression(node.callee);
  const name = calleeName(node);
  if (!name || CHEAP_BUILTINS.has(name)) return false;
  if (EXPENSIVE_CALLEES.has(name) || EXPENSIVE_PREFIX.test(name)) return true;
  if (callee?.type !== "MemberExpression" && callee?.type !== "OptionalMemberExpression") {
    return false;
  }
  if (name === "fromEntries" && objectName(callee.object) === "Object") return true;
  if (name === "parse" && objectName(callee.object) === "JSON") return true;
  if (name === "getItem") return true;
  return name === "map" || name === "filter" || name === "reduce";
}

function isExpensiveNew(node) {
  const ctor = unwrapExpression(node.callee);
  return ctor?.type === "Identifier" && EXPENSIVE_CTORS.has(ctor.name);
}

function isExpensiveInit(node) {
  const value = unwrapExpression(node);
  if (!value) return false;
  if (value.type === "CallExpression" || value.type === "OptionalCallExpression") {
    return isExpensiveCall(value);
  }
  if (value.type === "NewExpression") return isExpensiveNew(value);
  return false;
}

function isUseStateCallee(node, names, namespaces) {
  const callee = unwrapExpression(node);
  if (callee?.type === "Identifier") return names.has(callee.name);
  if (callee?.type === "MemberExpression" || callee?.type === "OptionalMemberExpression") {
    return (
      getPropertyName(callee.property) === "useState" &&
      unwrapExpression(callee.object)?.type === "Identifier" &&
      namespaces.has(unwrapExpression(callee.object).name)
    );
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Require lazy useState init for expensive values." },
  },
  create(context) {
    const names = new Set();
    const namespaces = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "react") return;
        for (const spec of node.specifiers ?? []) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported &&
            getPropertyName(spec.imported) === "useState"
          ) {
            names.add(spec.local.name);
          } else if (
            spec.type === "ImportDefaultSpecifier" ||
            spec.type === "ImportNamespaceSpecifier"
          ) {
            namespaces.add(spec.local.name);
          }
        }
      },
      CallExpression(node) {
        if (!isUseStateCallee(node.callee, names, namespaces)) return;
        const arg = node.arguments?.[0];
        if (!arg || arg.type === "SpreadElement") return;
        if (isExpensiveInit(arg)) {
          context.report({ node: arg, message });
        }
      },
    };
  },
};
