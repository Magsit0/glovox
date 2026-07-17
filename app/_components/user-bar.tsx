import Link from "next/link";
import { signOut } from "@/lib/auth";

export function UserBar({
  email,
  isSuperadmin = false,
}: {
  email: string | null | undefined;
  isSuperadmin?: boolean;
}) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="absolute right-4 top-4 flex items-center gap-3 font-sans text-sm text-[#666666]">
      {email && <span className="hidden sm:inline">{email}</span>}
      {isSuperadmin ? (
        <Link
          href="/admin/users"
          className="rounded-lg bg-[#9F99F8] px-3 py-1.5 font-medium text-white transition-colors hover:bg-[#8780F0]"
        >
          Admin
        </Link>
      ) : null}
      <form action={logout}>
        <button
          type="submit"
          className="cursor-pointer rounded-lg border border-[#333333] bg-white px-3 py-1.5 font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
