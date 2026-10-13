const functionNamePattern = /^[a-z]/;

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

function getTypeReferenceName(typeAnnotation) {
  if (typeAnnotation?.type !== "TSTypeReference") {
    return undefined;
  }

  const typeName = typeAnnotation.typeName;

  if (typeName?.type === "Identifier") {
    return typeName.name;
  }

  return undefined;
}

function isRegularFunctionName(name) {
  return typeof name === "string" && functionNamePattern.test(name);
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
      description: "Require named Args types for regular function destructured object parameters.",
    },
    messages: {
      namedArgs:
        "Use a named Args type instead of an inline object type for this function's arguments. Skill: react -> references/linting.md.",
      argsSuffix:
        "Function argument type names must end with Args. Skill: react -> references/linting.md.",
    },
  },
  create(context) {
    function check(name, node) {
      if (!isRegularFunctionName(name) || !hasDestructuredFirstParam(node)) {
        return;
      }

      if (hasInlineObjectFirstParamType(node)) {
        reportFirstParamType(context, node, "namedArgs");
        return;
      }

      const typeName = getTypeReferenceName(getFirstParamType(node));

      if (typeName && !typeName.endsWith("Args")) {
        reportFirstParamType(context, node, "argsSuffix");
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
