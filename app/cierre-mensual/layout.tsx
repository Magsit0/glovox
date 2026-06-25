export default function UnabaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-[#FAFAFA]">
      {children}
    </main>
  );
}
