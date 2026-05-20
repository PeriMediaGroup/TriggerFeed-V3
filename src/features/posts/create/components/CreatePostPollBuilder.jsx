"use client";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function createEmptyPoll() {
  return {
    question: "",
    options: ["", ""],
    allowsMultiple: false,
  };
}

export default function CreatePostPollBuilder({ poll, onChange, onRemove }) {
  const currentPoll = poll || createEmptyPoll();

  function updatePoll(nextValues) {
    onChange({
      ...currentPoll,
      ...nextValues,
    });
  }

  function updateQuestion(value) {
    updatePoll({ question: value });
  }

  function updateOption(index, value) {
    const nextOptions = [...currentPoll.options];
    nextOptions[index] = value;

    updatePoll({ options: nextOptions });
  }

  function addOption() {
    if (currentPoll.options.length >= MAX_OPTIONS) return;

    updatePoll({
      options: [...currentPoll.options, ""],
    });
  }

  function removeOption(index) {
    if (currentPoll.options.length <= MIN_OPTIONS) return;

    updatePoll({
      options: currentPoll.options.filter((_, optionIndex) => {
        return optionIndex !== index;
      }),
    });
  }

  return (
    <section className="create-post__poll-builder">
      <div className="create-post__poll-header">
        <h2>Create poll</h2>

        <button type="button" onClick={onRemove}>
          Remove poll
        </button>
      </div>

      <div className="create-post__field">
        <label htmlFor="poll-question">Poll question</label>

        <input
          id="poll-question"
          type="text"
          value={currentPoll.question}
          onChange={(event) => updateQuestion(event.target.value)}
          placeholder="Ask a question"
          maxLength={180}
        />
      </div>

      <div className="create-post__poll-options">
        {currentPoll.options.map((option, index) => (
          <div key={index} className="create-post__poll-option">
            <label htmlFor={`poll-option-${index}`}>
              Option {index + 1}
            </label>

            <div className="create-post__poll-option-row">
              <input
                id={`poll-option-${index}`}
                type="text"
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                maxLength={120}
              />

              {currentPoll.options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  aria-label={`Remove option ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        disabled={currentPoll.options.length >= MAX_OPTIONS}
      >
        Add option
      </button>

    </section>
  );
}