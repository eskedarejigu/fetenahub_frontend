import { useEffect, useMemo, useState } from "react";
import { api, uploadExamFiles } from "./api.js";
import { getInitData } from "./telegram.js";

const tabs = ["home", "upload", "profile"];
const emptyExam = {
  university_id: "",
  course_id: "",
  teacher_name: "",
  year: "",
  exam_type: ""
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [me, setMe] = useState(null);
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({
    university_id: "",
    course_id: "",
    teacher: "",
    year: "",
    search: "",
    followed: false
  });
  const [uploadForm, setUploadForm] = useState(emptyExam);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);

  useEffect(() => {
    const initData = getInitData();
    if (!initData) return;

    api
      .auth(initData)
      .then((data) => setMe(data.user))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .listExams(queryString)
      .then((data) => {
        setExams(data.exams || []);
        localStorage.setItem("cached_exams", JSON.stringify(data.exams || []));
      })
      .catch((err) => {
        const cached = localStorage.getItem("cached_exams");
        if (cached) {
          setExams(JSON.parse(cached));
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [queryString]);

  async function handleUploadSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setUploadProgress(0);

    try {
      const examResponse = await api.createExam(uploadForm);
      const examId = examResponse.exam.id;

      if (uploadFiles.length === 0) {
        throw new Error("no_files_selected");
      }

      await uploadExamFiles(examId, uploadFiles, setUploadProgress);
      setUploadForm(emptyExam);
      setUploadFiles([]);
      setActiveTab("home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSave() {
    if (!me) return;
    setLoading(true);
    setError("");

    try {
      const updated = await api.updateMe({
        username: me.username,
        bio: me.bio,
        avatar_url: me.avatar_url
      });
      setMe(updated.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewExam(examId) {
    setError("");
    try {
      const data = await api.getExam(examId);
      setSelectedExam(data.exam);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleShareExam(examId) {
    const url = `${window.location.origin}?exam=${examId}`;
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => null);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>FetenaHub</h1>
          <p className="muted">ExamHub for students</p>
        </div>
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      {activeTab === "home" && (
        <section className="section">
          <div className="filters">
            <input
              placeholder="University ID"
              value={filters.university_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, university_id: e.target.value }))}
            />
            <input
              placeholder="Course ID"
              value={filters.course_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, course_id: e.target.value }))}
            />
            <input
              placeholder="Teacher"
              value={filters.teacher}
              onChange={(e) => setFilters((prev) => ({ ...prev, teacher: e.target.value }))}
            />
            <input
              placeholder="Year"
              value={filters.year}
              onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            />
            <input
              placeholder="Search"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={filters.followed}
                onChange={(e) => setFilters((prev) => ({ ...prev, followed: e.target.checked }))}
              />
              Followed only
            </label>
          </div>

          {loading && <p className="muted">Loading...</p>}
          {!loading && exams.length === 0 && <p className="muted">No exams yet.</p>}

          <div className="cards">
            {exams.map((exam) => (
              <article className="card" key={exam.id}>
                <h3>{exam.courses?.name || "Course"}</h3>
                <p className="muted">
                  {exam.teacher_name} · {exam.year} · {exam.exam_type}
                </p>
                <div className="row">
                  <button className="ghost" onClick={() => handleViewExam(exam.id)}>
                    View files
                  </button>
                  <button className="ghost" onClick={() => handleShareExam(exam.id)}>
                    Share
                  </button>
                  <button onClick={() => api.likeExam(exam.id).catch((err) => setError(err.message))}>
                    Like
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      api
                        .report({
                          target_type: "exam",
                          target_id: exam.id,
                          reason: "wrong_content"
                        })
                        .catch((err) => setError(err.message))
                    }
                  >
                    Report
                  </button>
                </div>
              </article>
            ))}
          </div>

          {selectedExam && (
            <div className="card">
              <h3>Files</h3>
              {selectedExam.exam_files?.length ? (
                <div className="files">
                  {selectedExam.exam_files.map((file) => (
                    <a className="file-link" key={file.id} href={file.file_url} target="_blank" rel="noreferrer">
                      Open page {file.page_order}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted">No files found.</p>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "upload" && (
        <section className="section">
          <form className="form" onSubmit={handleUploadSubmit}>
            <input
              placeholder="University ID"
              value={uploadForm.university_id}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, university_id: e.target.value }))}
              required
            />
            <input
              placeholder="Course ID"
              value={uploadForm.course_id}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, course_id: e.target.value }))}
              required
            />
            <input
              placeholder="Teacher name"
              value={uploadForm.teacher_name}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, teacher_name: e.target.value }))}
              required
            />
            <input
              placeholder="Exam year"
              value={uploadForm.year}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, year: e.target.value }))}
              required
            />
            <select
              value={uploadForm.exam_type}
              onChange={(e) => setUploadForm((prev) => ({ ...prev, exam_type: e.target.value }))}
              required
            >
              <option value="">Select exam type</option>
              <option value="mid">Mid</option>
              <option value="final">Final</option>
              <option value="quiz">Quiz</option>
              <option value="other">Other</option>
            </select>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
              required
            />
            {uploadFiles.length > 0 && (
              <div className="file-preview">
                <p className="muted">Selected files:</p>
                <ul>
                  {uploadFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress">Upload progress: {uploadProgress}%</div>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </section>
      )}

      {activeTab === "profile" && (
        <section className="section">
          {!me && <p className="muted">Loading profile...</p>}
          {me && (
            <div className="profile">
              <input
                placeholder="Username"
                value={me.username || ""}
                onChange={(e) => setMe((prev) => ({ ...prev, username: e.target.value }))}
              />
              <input
                placeholder="Avatar URL"
                value={me.avatar_url || ""}
                onChange={(e) => setMe((prev) => ({ ...prev, avatar_url: e.target.value }))}
              />
              <textarea
                placeholder="Bio"
                value={me.bio || ""}
                onChange={(e) => setMe((prev) => ({ ...prev, bio: e.target.value }))}
              />
              <button onClick={handleProfileSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
