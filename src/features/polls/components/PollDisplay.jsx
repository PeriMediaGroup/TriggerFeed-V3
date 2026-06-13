"use client";

import { useMemo, useState, useTransition } from "react";
import { answerPoll } from "../actions/answerPoll";

export default function PollDisplay({ poll, postId, currentUserId }) {
  const [status, setStatus] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState(
    poll?.my_option_id || null,
  );

  const [isPending, startTransition] = useTransition();

  const options = useMemo(() => {
    return [...(poll?.poll_options || [])].sort((a, b) => {
      return a.display_order - b.display_order;
    });
  }, [poll?.poll_options]);

  const responseCounts = useMemo(() => {
    const counts = new Map();

    options.forEach((option) => {
      counts.set(option.id, 0);
    });

    (poll?.poll_results || []).forEach((result) => {
      counts.set(result.option_id, result.vote_count || 0);
    });

    return counts;
  }, [options, poll?.poll_results]);

  const totalResponses = useMemo(() => {
    return Array.from(responseCounts.values()).reduce((total, count) => {
      return total + count;
    }, 0);
  }, [responseCounts]);

  if (!poll) return null;
  if (!poll.question || options.length === 0) return null;

  function handleAnswer(optionId) {
    if (!currentUserId) {
      setStatus("Log in to answer this poll.");
      return;
    }

    setSelectedOptionId(optionId);
    setStatus("");

    startTransition(async () => {
      const result = await answerPoll({
        pollId: poll.id,
        optionId,
        postId,
      });

      if (!result.success) {
        setStatus(result.message || "Could not save poll answer.");
      }
    });
  }

  return (
    <section className="post-poll">
      <h3 className="post-poll__question">{poll.question}</h3>

      <div className="post-poll__options">
        {options.map((option) => {
          const count = responseCounts.get(option.id) || 0;
          const percentage =
            totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;

          const isSelected = selectedOptionId === option.id;
          const showResults = Boolean(selectedOptionId) || totalResponses > 0;

          return (
            <button
              key={option.id}
              type="button"
              className={`post-poll__option${
                isSelected ? " post-poll__option--selected" : ""
              }${showResults ? " post-poll__option--results" : ""}`}
              onClick={() => handleAnswer(option.id)}
              disabled={isPending}
            >
              {showResults ? (
                <span
                  className="post-poll__result-bar"
                  style={{ width: `${percentage}%` }}
                />
              ) : null}

              <span className="post-poll__option-content">
                <span className="post-poll__option-label">
                  {option.option_text}
                  {isSelected ? (
                    <span className="post-poll__selected-badge">
                      Selected
                    </span>
                  ) : null}
                </span>

                {showResults ? (
                  <span className="post-poll__option-meta">
                    {count} {count === 1 ? "answer" : "answers"} · {percentage}%
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="post-poll__total">
        {totalResponses} {totalResponses === 1 ? "response" : "responses"}
      </p>

      {status && <p className="post-poll__status">{status}</p>}
    </section>
  );
}
