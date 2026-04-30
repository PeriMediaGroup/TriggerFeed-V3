import Link from "next/link";

export default function ProfileShowcase({ topFriends = [], topGuns = [] }) {
  return (
    <section className="profile-showcase">
      <div className="profile-showcase__section">
        <div className="profile-showcase__header">
          <h2 className="profile-showcase__title">Top Friends</h2>
          <span className="profile-showcase__count">{topFriends.length}/4</span>
        </div>

        {topFriends.length > 0 ? (
          <ul className="profile-showcase__grid">
            {topFriends.map((item) => {
              const friend = item.friend || item.profile || item;

              const displayName =
                friend?.display_name ||
                [friend?.first_name, friend?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                friend?.username ||
                "Unknown Friend";

              return (
                <li
                  key={item.id || friend.id}
                  className="profile-showcase__item"
                >
                  <Link
                    href={`/profiles/${friend.id}`}
                    className="profile-showcase__link"
                  >
                    <div className="profile-showcase__avatar">
                      {friend?.avatar_cloudinary_url ? (
                        <img
                          src={friend.avatar_cloudinary_url}
                          alt={`${displayName} avatar`}
                          className="profile-showcase__avatar-image"
                        />
                      ) : (
                        <span>{displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    <span className="profile-showcase__name">
                      {displayName}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="profile-showcase__empty">
            No top friends selected yet.
          </p>
        )}
      </div>

      <div className="profile-showcase__section">
        <div className="profile-showcase__header">
          <h2 className="profile-showcase__title">Top Guns</h2>
          <span className="profile-showcase__count">{topGuns.length}/4</span>
        </div>

        {topGuns.length > 0 ? (
          <ol className="profile-showcase__grid">
            {topGuns.map((gun) => (
              <li key={gun.id} className="profile-showcase__item">
                <div className="profile-showcase__gun">
                  <span className="profile-showcase__rank">
                    #{gun.display_order + 1} &nbsp;
                  </span>

                  <span className="profile-showcase__name">{gun.name}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="profile-showcase__empty">No top guns added yet.</p>
        )}
      </div>
    </section>
  );
}
