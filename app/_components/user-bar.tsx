import { signOut } from "@/lib/auth";

export function UserBar({ email }: { email: string | null | undefined }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="absolute right-4 top-4 flex items-center gap-3 font-mono-data text-xs uppercase tracking-widest text-black">
      {email && <span className="hidden sm:inline">{email}</span>}
      <form action={logout}>
        <button
          type="submit"
          className="border-2 border-black bg-white px-3 py-1.5 font-bold uppercase shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#FFFF00] cursor-pointer"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
