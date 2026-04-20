"use client";

import { useActionState } from "react";
import { adminUpdateUserRole, adminDeleteClaim, type AdminActionState } from "@/app/actions/admin";

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  created_at?: string;
};

type Claim = {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_description?: string | null;
  status: string;
  created_at?: string;
  item_title?: string;
  claimant_email?: string;
};

function RoleSelect({ user }: { user: Profile }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminUpdateUserRole,
    undefined
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <select
        name="role"
        defaultValue={user.role}
        onChange={(e) => {
          const form = e.currentTarget.closest("form") as HTMLFormElement;
          form.requestSubmit();
        }}
        disabled={pending}
        className="rounded-md border border-sky-300 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 dark:border-sky-700 dark:bg-sky-950"
      >
        <option value="student">student</option>
        <option value="admin">admin</option>
        <option value="pickup_point">pickup_point</option>
      </select>
      {state?.message && (
        <span
          className={`text-[11px] ${state.success ? "text-emerald-700" : "text-rose-600"}`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

function DeleteClaimButton({ claim }: { claim: Claim }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminDeleteClaim,
    undefined
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="claimId" value={claim.id} />
      <button
        disabled={pending}
        className="rounded-md border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950"
        onClick={(e) => {
          if (!confirm("Delete this claim?")) e.preventDefault();
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.message && !state.success && (
        <span className="ml-2 text-[11px] text-rose-600">{state.message}</span>
      )}
    </form>
  );
}

export function AdminUsersTable({ users }: { users: Profile[] }) {
  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
        No users found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-sky-200 dark:border-sky-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50 text-left dark:border-sky-800 dark:bg-sky-950">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-sky-100 last:border-0 hover:bg-sky-50 dark:border-sky-900 dark:hover:bg-sky-950"
            >
              <td className="px-4 py-2 font-medium">
                {user.full_name ?? <span className="text-sky-400 italic">No name</span>}
              </td>
              <td className="px-4 py-2 text-sky-700 dark:text-sky-300">{user.email ?? "—"}</td>
              <td className="px-4 py-2">
                <RoleSelect user={user} />
              </td>
              <td className="px-4 py-2 text-sky-600 dark:text-sky-400">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminClaimsTable({ claims }: { claims: Claim[] }) {
  if (claims.length === 0) {
    return (
      <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
        No claims found.
      </p>
    );
  }

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-sky-200 dark:border-sky-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50 text-left dark:border-sky-800 dark:bg-sky-950">
            <th className="px-4 py-2 font-medium">Item</th>
            <th className="px-4 py-2 font-medium">Claimant</th>
            <th className="px-4 py-2 font-medium">Proof</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr
              key={claim.id}
              className="border-b border-sky-100 last:border-0 hover:bg-sky-50 dark:border-sky-900 dark:hover:bg-sky-950"
            >
              <td className="px-4 py-2 font-medium">
                {claim.item_title ?? claim.item_id.slice(0, 8) + "…"}
              </td>
              <td className="px-4 py-2 text-sky-700 dark:text-sky-300">
                {claim.claimant_email ?? claim.claimant_id.slice(0, 8) + "…"}
              </td>
              <td className="max-w-xs px-4 py-2 text-sky-700 dark:text-sky-300">
                {claim.proof_description ?? <span className="italic text-sky-400">None</span>}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statusColor[claim.status] ?? "bg-sky-100 text-sky-700"}`}
                >
                  {claim.status}
                </span>
              </td>
              <td className="px-4 py-2 text-sky-600 dark:text-sky-400">
                {claim.created_at ? new Date(claim.created_at).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-2">
                <DeleteClaimButton claim={claim} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
