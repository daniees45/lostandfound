"use client";

import { useState } from "react";

type CustodyLog = {
  id: string;
  item_title: string;
  from_user_email: string;
  to_user_email: string;
  verification_method: string;
  notes: string | null;
  created_at: string;
};

export function AdminLogsTable({ logs }: { logs: CustodyLog[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.item_title?.toLowerCase().includes(term) ||
      log.from_user_email?.toLowerCase().includes(term) ||
      log.to_user_email?.toLowerCase().includes(term) ||
      log.verification_method.toLowerCase().includes(term) ||
      log.notes?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="rounded-xl border border-sky-200 bg-white shadow-sm dark:border-sky-800 dark:bg-sky-950">
      <div className="p-4">
        <input
          type="text"
          placeholder="Search logs by item, user, or method..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full max-w-sm rounded-md border border-sky-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">From User</th>
              <th className="px-4 py-3">To User</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 max-w-xs">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-100 dark:divide-sky-800/50">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sky-500">
                  No logs found matching your search.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-sky-50/50 dark:hover:bg-sky-900/20">
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{log.item_title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sky-600 dark:text-sky-400">
                    {log.from_user_email}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sky-600 dark:text-sky-400">
                    {log.to_user_email}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                      {log.verification_method.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs opacity-80 max-w-xs truncate" title={log.notes || ""}>
                    {log.notes || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-sky-100 p-4 dark:border-sky-800/50">
          <p className="text-xs text-sky-600 dark:text-sky-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}{" "}
            entries
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-sky-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-sky-800"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-sky-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-sky-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
