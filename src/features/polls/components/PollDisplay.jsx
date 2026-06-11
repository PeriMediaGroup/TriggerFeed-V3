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
    <section className="poll-display">
      <h3 className="poll-display__question">{poll.question}</h3>

      <div className="poll-display__options">
        {options.map((option) => {
          const count = responseCounts.get(option.id) || 0;
          const percentage =
            totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;

          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              className={`poll-display__option${
                isSelected ? " poll-display__option--selected" : ""
              }`}
              onClick={() => handleAnswer(option.id)}
              disabled={isPending}
            >
              <span className="poll-display__option-text">
                {option.option_text}
              </span>

              <span className="poll-display__option-meta">
                {count} {count === 1 ? "answer" : "answers"} · {percentage}%
              </span>
            </button>
          );
        })}
      </div>

      <p className="poll-display__meta">
        {totalResponses} {totalResponses === 1 ? "response" : "responses"}
      </p>

      {status && <p className="poll-display__status">{status}</p>}
    </section>
  );
}
