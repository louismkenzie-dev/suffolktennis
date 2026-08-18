import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const AdminLink = () => {
  const { isAdmin } = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-lta-yellow text-suffolk-navy text-xs font-bold hover:bg-lta-yellow/90 transition-colors"
    >
      <Shield size={14} />
      Admin Hub
    </Link>
  );
};

export default AdminLink;
