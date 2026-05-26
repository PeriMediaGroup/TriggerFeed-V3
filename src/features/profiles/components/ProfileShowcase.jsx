import Link from "next/link";
import Image from "next/image";

export default function ProfileShowcase({ topFriends = [], topGuns = [] }) {
  return (
    <section className="profile-showcase">
      <h2>My Top Four...</h2>
      <div className="profile-showcase__section">
        <div className="profile-showcase__header">
          <h3 className="profile-showcase__title">Friends</h3>
        </div>
        {topFriends.length > 0 ? (
          <ul className="profile-showcase__grid">
            {topFriends.map((item, index) => {
              const friend = item.friend || item.profile || item;

              const displayName =
                friend?.display_name ||
                [friend?.first_name, friend?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                friend?.username ||
                "Unknown Friend";

              const rank =
                (item.display_order ?? friend?.display_order ?? index) + 1;

              return (
                <li
                  key={item.id || friend.id}
                  className="profile-showcase__item"
                >
                  <span className="profile-showcase__rank">#{rank} &nbsp;</span>
                  <Link
                    href={`/profiles/${friend.id}`}
                    className="profile-showcase__link"
                  >
                    <div className="profile-showcase__avatar">
                      {friend?.avatar_cloudinary_url ? (
                        <Image
                          src={friend.avatar_cloudinary_url}
                          alt={`${displayName} avatar`}
                          width={50}
                          height={50}
                          className="profile-showcase__avatar-image"
                        />
                      ) : (
                        <Image
                          className="profile-showcase__avatar-image"
                          src="https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png"
                          alt="Default Avatar"
                          width={50}
                          height={50}
                        />
                      )}
                    </div>

                    <div className="profile-showcase__name">{displayName}</div>
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
          <h3 className="profile-showcase__title">Guns</h3>
        </div>

        {topGuns.length > 0 ? (
          <ol className="profile-showcase__grid">
            {topGuns.map((gun) => (
              <li key={gun.id} className="profile-showcase__item">
                <span className="profile-showcase__rank">
                  #{gun.display_order + 1} &nbsp;
                </span>
                <div className="profile-showcase__gun">
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
