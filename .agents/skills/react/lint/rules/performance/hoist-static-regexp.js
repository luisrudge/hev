import { unwrapExpression } from "../../utils.js";

const message =
  "Hoist this static regular expression to module scope so it is not recreated. Skill: react -> references/performance/js-hoist-regexp.md.";

function functionName(node) {
  if (node.id?.name) return node.id.name;
  const parent = node.parent;
  if (!parent) return undefined;
  if (parent.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent.type === "AssignmentExpression" && parent.left?.type === "Identifier") {
    return parent.left.name;
  }
  if (
    (parent.type === "Property" ||
      parent.type === "PropertyDefinition" ||
      parent.type === "MethodDefinition") &&
    parent.key?.type === "Identifier"
  ) {
    return parent.key.name;
  }
  return undefined;
}

function isComponentOrHook(node) {
  const name = functionName(node);
  if (!name) return false;
  return /^use[A-Z]/.test(name) || /^[A-Z]/.test(name);
}

function isStaticString(node) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if (expr.type === "Literal" || expr.type === "StringLiteral") {
    return typeof expr.value === "string";
  }
  return expr.type === "TemplateLiteral" && expr.expressions.length === 0;
}

function staticStringValue(node) {
  const expr = unwrapExpression(node);
  if (expr.type === "TemplateLiteral") return expr.quasis[0]?.value?.cooked ?? "";
  return expr.value;
}

function hasStatefulFlags(flags) {
  return typeof flags === "string" && /[gy]/.test(flags);
}

function regexLiteralFlags(node) {
  if (node.regex) return node.regex.flags ?? "";
  if (node.type === "RegExpLiteral") return node.flags ?? "";
  return undefined;
}

function isRegExpCallee(context, node) {
  const callee = unwrapExpression(node);
  if (callee?.type !== "Identifier" || callee.name !== "RegExp") return false;
  const sourceCode = context.sourceCode ?? context.getSourceCode?.();
  let scope = sourceCode?.getScope?.(callee) ?? context.getScope?.();
  while (scope) {
    const variable = scope.variables.find((entry) => entry.name === "RegExp");
    if (variable) return variable.defs.length === 0;
    scope = scope.upper;
  }
  return true;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Hoist static RegExp creation out of components, hooks, and loops.",
    },
  },
  create(context) {
    const stack = [{ hoist: false, loopDepth: 0 }];

    const enterFunction = (node) => {
      const parent = stack.at(-1);
      stack.push({
        hoist: parent.hoist || isComponentOrHook(node),
        loopDepth: parent.loopDepth,
      });
    };
    const exitFunction = () => {
      stack.pop();
    };
    const enterLoop = () => {
      stack.at(-1).loopDepth += 1;
    };
    const exitLoop = () => {
      stack.at(-1).loopDepth -= 1;
    };

    const inReportScope = () => {
      const frame = stack.at(-1);
      return frame.hoist || frame.loopDepth > 0;
    };

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      ForStatement: enterLoop,
      ForInStatement: enterLoop,
      ForOfStatement: enterLoop,
      WhileStatement: enterLoop,
      DoWhileStatement: enterLoop,
      "ForStatement:exit": exitLoop,
      "ForInStatement:exit": exitLoop,
      "ForOfStatement:exit": exitLoop,
      "WhileStatement:exit": exitLoop,
      "DoWhileStatement:exit": exitLoop,
      Literal(node) {
        const flags = regexLiteralFlags(node);
        if (flags === undefined) return;
        if (hasStatefulFlags(flags)) return;
        if (!inReportScope()) return;
        context.report({ node, message });
      },
      NewExpression(node) {
        reportStaticRegExpCall(context, node);
      },
      CallExpression(node) {
        reportStaticRegExpCall(context, node);
      },
    };

    function reportStaticRegExpCall(context, node) {
      if (!isRegExpCallee(context, node.callee)) return;
      if (!inReportScope()) return;
      const [pattern, flagsArg] = node.arguments;
      if (!pattern || pattern.type === "SpreadElement") return;
      if (!isStaticString(pattern)) return;
      if (flagsArg) {
        if (flagsArg.type === "SpreadElement" || !isStaticString(flagsArg)) return;
        if (hasStatefulFlags(staticStringValue(flagsArg))) return;
      }
      context.report({ node, message });
    }
  },
};
