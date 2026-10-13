const componentNamePattern = /^[A-Z]/;

function getFirstParamTypeAnnotation(node) {
  return node.params?.[0]?.typeAnnotation;
}

function getFirstParamType(node) {
  return getFirstParamTypeAnnotation(node)?.typeAnnotation;
}

function hasDestructuredFirstParam(node) {
  return node?.params?.[0]?.type === "ObjectPattern";
}

function hasInlineObjectFirstParamType(node) {
  return hasDestructuredFirstParam(node) && getFirstParamType(node)?.type === "TSTypeLiteral";
}

function isComponentName(name) {
  return typeof name === "string" && componentNamePattern.test(name);
}

function reportFirstParamType(context, node, messageId) {
  const typeAnnotation = getFirstParamTypeAnnotation(node);

  if (!typeAnnotation) {
    return;
  }

  context.report({
    node: typeAnnotation,
    messageId,
  });
}

function getFunctionDeclarationName(node) {
  return node.id?.name;
}

function getVariableFunction(node) {
  if (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression") {
    return node.init;
  }

  return undefined;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require named props types for React components.",
    },
    messages: {
      namedProps:
        "Use a named props type instead of an inline object type for this React component's props. Skill: react -> references/linting.md.",
    },
  },
  create(context) {
    function check(name, node) {
      if (isComponentName(name) && hasInlineObjectFirstParamType(node)) {
        reportFirstParamType(context, node, "namedProps");
      }
    }

    return {
      FunctionDeclaration(node) {
        check(getFunctionDeclarationName(node), node);
      },
      VariableDeclarator(node) {
        check(node.id?.name, getVariableFunction(node));
      },
    };
  },
};
