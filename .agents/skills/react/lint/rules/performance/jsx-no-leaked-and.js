import { getPropertyName, unwrapExpression } from "../../utils.js";

const NUMBER_NAME = /^(count|index|size|length|idx|n)$/i;
const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);

const message =
  "Do not use a numeric left-hand side with && in JSX; 0 and NaN leak into the output. Use an explicit comparison or ternary. Skill: react -> references/performance/rendering-conditional-render.md.";

function isNumberShaped(node) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if (expr.type === "Literal" || expr.type === "NumericLiteral") {
    return typeof expr.value === "number";
  }
  if (expr.type === "UnaryExpression" && (expr.operator === "+" || expr.operator === "-")) {
    return isNumberShaped(expr.argument);
  }
  if (expr.type === "BinaryExpression" && ARITHMETIC.has(expr.operator)) return true;
  if (expr.type === "MemberExpression" && getPropertyName(expr.property) === "length") return true;
  if (expr.type === "Identifier" && NUMBER_NAME.test(expr.name)) return true;
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow numeric values leaking through JSX && rendering.",
    },
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        const expr = unwrapExpression(node.expression);
        if (expr?.type !== "LogicalExpression" || expr.operator !== "&&") return;
        if (!isNumberShaped(expr.left)) return;
        context.report({ node: expr, message });
      },
    };
  },
};
