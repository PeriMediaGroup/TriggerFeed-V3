import AdminSectionNav from "./AdminSectionNav";

export default function AdminManagementNav({ activeSection, counts = null }) {
  return <AdminSectionNav activeSection={activeSection} counts={counts} />;
}
