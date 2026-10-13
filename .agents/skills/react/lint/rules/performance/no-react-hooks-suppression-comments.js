const hookSuppressionCommentPattern =
  /(?:eslint|oxlint)-disable(?:-next-line|-line)?[^\n]*(?:react-hooks|react)\/(exhaustive-deps|rules-of-hooks)/;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban react-hooks disable comments: they silently opt the enclosing function out of React Compiler optimization.",
    },
    schema: [],
    messages: {
      banned:
        "'{{rule}}' is disabled by comment, which also silently opts this function out of React Compiler optimization. Use a complete dependency array, useEffectEvent, or a declarative alternative instead. Skill: react -> references/performance/index.md.",
    },
  },
  create(context) {
    function check(comments) {
      for (const comment of comments ?? []) {
        const match = hookSuppressionCommentPattern.exec(comment.value);
        if (!match) {
          continue;
        }
        context.report({
          node: undefined,
          loc: comment.loc,
          messageId: "banned",
          data: { rule: match[1] },
        });
      }
    }

    return {
      Program(program, context_) {
        if (Array.isArray(program.comments)) {
          check(program.comments);
          return;
        }
        check(context_?.sourceCode?.getAllComments?.());
      },
    };
  },
};
