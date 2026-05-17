export default function PollDisplay({ poll }) {
  if (!poll) return null;

  const options = [...(poll.poll_options || [])].sort((a, b) => {
    return a.display_order - b.display_order;
  });

  if (!poll.question || options.length === 0) return null;

  return (
    <section className="poll-display">
      <h3 className="poll-display__question">{poll.question}</h3>

      <div className="poll-display__options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="poll-display__option"
            disabled
          >
            {option.option_text}
          </button>
        ))}
      </div>

      <p className="poll-display__meta">
        Poll answering coming soon
      </p>
    </section>
  );
}