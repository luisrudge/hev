export function unwrapExpression(node) {
  let current = node;
  while (
    current?.type === "ChainExpression" ||
    current?.type === "ParenthesizedExpression" ||
    current?.type === "TSNonNullExpression" ||
    current?.type === "TSAsExpression" ||
    current?.type === "TSTypeAssertion" ||
    current?.type === "TSSatisfiesExpression"
  ) {
    current = current.expression;
  }
  return current;
}

export function getPropertyName(node) {
  if (!node) return undefined;
  if (node.type === "Identifier" || node.type === "JSXIdentifier") return node.name;
  if (node.type === "Literal" || node.type === "StringLiteral") return node.value;
  return undefined;
}

export function getJSXName(node) {
  if (!node) return undefined;
  if (node.type === "JSXIdentifier" || node.type === "Identifier") return node.name;
  if (node.type === "JSXMemberExpression") {
    const object = getJSXName(node.object);
    const property = getJSXName(node.property);
    return object && property ? `${object}.${property}` : undefined;
  }
  return undefined;
}

export function getJSXAttribute(node, name) {
  return node?.attributes?.find(
    (attribute) => attribute.type === "JSXAttribute" && getPropertyName(attribute.name) === name,
  );
}

export function getJSXAttributeExpression(attribute) {
  if (!attribute?.value) return undefined;
  if (attribute.value.type === "JSXExpressionContainer") {
    return unwrapExpression(attribute.value.expression);
  }
  return unwrapExpression(attribute.value);
}

export function isViewTransition(node) {
  const opening = node?.type === "JSXElement" ? node.openingElement : node;
  const name = getJSXName(opening?.name);
  return name === "ViewTransition" || name === "React.ViewTransition";
}

export function hasJSXSpread(node) {
  return node?.attributes?.some((attribute) => attribute.type === "JSXSpreadAttribute") ?? false;
}
