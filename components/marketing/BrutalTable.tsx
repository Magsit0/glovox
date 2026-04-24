export type BrutalColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
};

type BrutalTableProps<T> = {
  columns: BrutalColumn<T>[];
  data: T[];
};

export default function BrutalTable<T>({
  columns,
  data,
}: BrutalTableProps<T>) {
  return (
    <div className="border-4 border-black rounded-none w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-black text-white">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`font-mono-data uppercase text-xs px-4 py-3 ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`font-mono-data text-sm px-4 py-3 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
