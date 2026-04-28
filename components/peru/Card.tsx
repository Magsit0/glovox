import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  className = "",
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`bg-white border border-[#E5E5E5] rounded-lg p-6 ${className}`}
    >
      {(title || subtitle || action) && (
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            {title && (
              <h2 className="font-display font-bold text-lg text-[#333333]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="font-sans text-sm text-[#666666] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
