export function cleanPollDraft(poll) {
  if (!poll) return null;

  const question = poll.question?.trim() || "";

  const options = (poll.options || [])
    .map((option) => option.trim())
    .filter(Boolean);

  if (!question && options.length === 0) {
    return null;
  }

  if (!question || options.length < 2) {
    return {
      error: "Polls need a question and at least two options.",
      poll: null,
    };
  }

  if (question.length > 180) {
    return {
      error: "Poll question must be 180 characters or less.",
      poll: null,
    };
  }

  if (options.some((option) => option.length > 120)) {
    return {
      error: "Poll options must be 120 characters or less.",
      poll: null,
    };
  }

  return {
    error: null,
    poll: {
      question,
      options,
      allowsMultiple: false,
    },
  };
}

export function createEmptyPollDraft() {
  return {
    question: "",
    options: ["", ""],
    allowsMultiple: false,
  };
}