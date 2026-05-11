import { useState } from "react";
import { updateOwnItem } from "@/app/actions/items";

export default function EditItemModal({ item, isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: item.title,
    category: item.category,
    description: item.description,
    location: item.location,
    status: item.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("itemId", item.id);
    formData.set("title", form.title);
    formData.set("category", form.category);
    formData.set("description", form.description);
    formData.set("location", form.location);
    formData.set("status", form.status);
    const result = await updateOwnItem(undefined, formData);
    setLoading(false);
    if (result?.errors) {
      setError("Please fix the errors and try again.");
    } else if (result?.message) {
      setSuccess(result.message);
      onSuccess?.();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-sky-950 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Edit Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="title" value={form.title} onChange={handleChange} className="w-full border rounded p-2" placeholder="Title" required />
          <input name="category" value={form.category} onChange={handleChange} className="w-full border rounded p-2" placeholder="Category" required />
          <textarea name="description" value={form.description} onChange={handleChange} className="w-full border rounded p-2" placeholder="Description" required />
          <input name="location" value={form.location} onChange={handleChange} className="w-full border rounded p-2" placeholder="Location" required />
          <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded p-2">
            <option value="lost">Lost</option>
            <option value="found">Found</option>
            <option value="claimed">Claimed</option>
            <option value="returned">Returned</option>
            <option value="held_at_pickup">Held at Pickup</option>
          </select>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-sky-800">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-sky-600 text-white">{loading ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
