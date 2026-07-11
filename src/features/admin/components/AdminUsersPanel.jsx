import Link from "next/link";

import AdminPageShell from "./AdminPageShell";
import AdminUserCard from "./AdminUserCard";

export default function AdminUsersPanel({
  users = [],
  query = "",
  currentUserId,
  permissions,
  error = null,
  adminCounts = null,
}) {
  return (
    <AdminPageShell
      activeSection="users"
      counts={adminCounts}
      title="Users"
      summary="Search users by username, display name, role, or status."
    >
      <section className="admin-users">
        <form className="admin-users__search" action="/admin/users">
          <label htmlFor="admin-user-search">Search users</label>
          <div className="admin-users__search-row">
            <input
              id="admin-user-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="username, display name, role, muted, banned"
            />
            <button type="submit">Search</button>
            {query ? <Link href="/admin/users">Clear</Link> : null}
          </div>
        </form>

        {error ? (
          <p className="admin-users__notice">Could not load users.</p>
        ) : null}

        {users.length > 0 ? (
          <div className="admin-users__list">
            {users.map((user) => (
              <AdminUserCard
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                permissions={permissions}
              />
            ))}
          </div>
        ) : (
          <p className="admin-users__empty">No users found.</p>
        )}
      </section>
    </AdminPageShell>
  );
}
