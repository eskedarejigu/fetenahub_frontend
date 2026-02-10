import { getInitData } from "./telegram.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const initData = getInitData();
  const headers = {
    "Content-Type": "application/json",
    "x-telegram-init-data": initData,
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = data?.error || "request_failed";
    throw new Error(message);
  }

  return data;
}

export const api = {
  auth: (initData) =>
    fetch(`${API_BASE}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "auth_failed");
      return data;
    }),
  getMe: () => request("/users/me"),
  updateMe: (payload) => request("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),
  listExams: (query = "") => request(`/exams${query}`),
  createExam: (payload) => request("/exams", { method: "POST", body: JSON.stringify(payload) }),
  getExam: (id) => request(`/exams/${id}`),
  likeExam: (id) => request(`/exams/${id}/like`, { method: "POST" }),
  unlikeExam: (id) => request(`/exams/${id}/like`, { method: "DELETE" }),
  report: (payload) => request("/reports", { method: "POST", body: JSON.stringify(payload) })
};

export function uploadExamFiles(examId, files, onProgress) {
  const initData = getInitData();
  const form = new FormData();
  files.forEach((file) => form.append("files", file));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/exams/${examId}/files`);
    xhr.setRequestHeader("x-telegram-init-data", initData);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.error || "upload_failed"));
        }
      } catch (err) {
        reject(new Error("upload_failed"));
      }
    };

    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.send(form);
  });
}
