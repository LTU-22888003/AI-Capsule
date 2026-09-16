import { useEffect, useState } from "react";
import "./App.css";

const emptyForm = {
  project_name: "",
  prompt_title: "",
  prompt_version: "v1",
  prompt_text: "",
  response_summary: "",
  category: "Coding",
  usefulness: "Good",
  reviewed: false,
  improved: false,
  screenshot_url: "",
  notes: "",
};

function App() {
  const [user, setUser] = useState(null);
  const [capsules, setCapsules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const isDashboard =
    window.location.pathname === "/dashboard";

  useEffect(() => {
    if (isDashboard) {
      checkUser();
    } else {
      setLoading(false);
    }
  }, []);

  async function checkUser() {
    try {
      const response = await fetch("/api/me", {
        credentials: "include",
      });

      if (!response.ok) {
        window.location.href = "/";
        return;
      }

      const data = await response.json();

      setUser(data);

      await loadCapsules();
    } catch (error) {
      console.error(error);
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  async function loadCapsules() {
    try {
      const response = await fetch("/api/capsules", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to load capsules");
      }

      const data = await response.json();

      setCapsules(data);
    } catch (error) {
      console.error(error);
      setMessage("Unable to load prompt records.");
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

    try {
      const url = editingId
        ? `/api/capsules/${editingId}`
        : "/api/capsules";

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Request failed"
        );
      }

      setMessage(
        editingId
          ? "Prompt record updated successfully."
          : "Prompt record created successfully."
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadCapsules();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(capsule) {
    setEditingId(capsule.id);

    setForm({
      project_name: capsule.project_name || "",
      prompt_title: capsule.prompt_title || "",
      prompt_version:
        capsule.prompt_version || "v1",
      prompt_text: capsule.prompt_text || "",
      response_summary:
        capsule.response_summary || "",
      category: capsule.category || "Coding",
      usefulness:
        capsule.usefulness || "Good",
      reviewed: Boolean(capsule.reviewed),
      improved: Boolean(capsule.improved),
      screenshot_url:
        capsule.screenshot_url || "",
      notes: capsule.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function deleteCapsule(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this prompt record?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/capsules/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Delete failed"
        );
      }

      setMessage(
        "Prompt record deleted successfully."
      );

      await loadCapsules();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    window.location.href = "/logout";
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <h2>Loading AI Capsule...</h2>
      </div>
    );
  }

  if (!isDashboard) {
    return (
      <div className="landing-page">
        <nav className="navbar">
          <div className="brand">
            AI Capsule
          </div>

          <a
            className="nav-login"
            href="/login"
          >
            Sign in with GitHub
          </a>
        </nav>

        <main className="hero">
          <div className="hero-content">
            <p className="eyebrow">
              YOUR PRIVATE AI PROMPT LIBRARY
            </p>

            <h1>
              Save, review and improve your
              best AI prompts.
            </h1>

            <p className="hero-text">
              AI Capsule gives you one secure
              place to store useful prompts for
              coding, writing, research and
              study.
            </p>

            <a
              className="primary-button"
              href="/login"
            >
              Continue with GitHub
            </a>
          </div>

          <div className="hero-card">
            <div className="mini-card">
              <span className="mini-label">
                Project
              </span>
              <strong>
                SmartFarm Dashboard
              </strong>
            </div>

            <div className="mini-card">
              <span className="mini-label">
                Prompt
              </span>
              <strong>
                Debug cloud deployment
              </strong>
            </div>

            <div className="mini-card">
              <span className="mini-label">
                Category
              </span>
              <strong>Coding</strong>
            </div>

            <div className="mini-card">
              <span className="mini-label">
                Usefulness
              </span>
              <strong>Good</strong>
            </div>
          </div>
        </main>

        <section className="feature-section">
          <div className="feature">
            <h3>Create</h3>
            <p>
              Save useful AI prompts and their
              response summaries.
            </p>
          </div>

          <div className="feature">
            <h3>Review</h3>
            <p>
              Record usefulness, improvement
              and review status.
            </p>
          </div>

          <div className="feature">
            <h3>Manage</h3>
            <p>
              Update or delete your own prompt
              records at any time.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>AI Capsule</h1>
          <p>
            Private Prompt Manager
          </p>
        </div>

        <div className="user-area">
          <span>
            Signed in as{" "}
            <strong>
              {user?.username}
            </strong>
          </span>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="form-card">
          <div className="section-heading">
            <div>
              <p className="section-label">
                PROMPT RECORD
              </p>

              <h2>
                {editingId
                  ? "Update Prompt"
                  : "Create New Prompt"}
              </h2>
            </div>

            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={cancelEdit}
              >
                Cancel Edit
              </button>
            )}
          </div>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <form
            className="capsule-form"
            onSubmit={handleSubmit}
          >
            <div className="form-grid">
              <label>
                Project Name *
                <input
                  name="project_name"
                  value={form.project_name}
                  onChange={handleChange}
                  placeholder="e.g. SmartFarm"
                  required
                />
              </label>

              <label>
                Prompt Title *
                <input
                  name="prompt_title"
                  value={form.prompt_title}
                  onChange={handleChange}
                  placeholder="e.g. Debug API"
                  required
                />
              </label>

              <label>
                Prompt Version
                <input
                  name="prompt_version"
                  value={form.prompt_version}
                  onChange={handleChange}
                  placeholder="v1"
                />
              </label>

              <label>
                Category
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  <option>Coding</option>
                  <option>Writing</option>
                  <option>Research</option>
                  <option>Study</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Usefulness
                <select
                  name="usefulness"
                  value={form.usefulness}
                  onChange={handleChange}
                >
                  <option>Good</option>
                  <option>
                    Needs Improvement
                  </option>
                </select>
              </label>

              <label>
                Screenshot URL
                <input
                  name="screenshot_url"
                  value={form.screenshot_url}
                  onChange={handleChange}
                  placeholder="https://..."
                />
              </label>
            </div>

            <label>
              Prompt Text *
              <textarea
                name="prompt_text"
                value={form.prompt_text}
                onChange={handleChange}
                placeholder="Enter the AI prompt..."
                rows="5"
                required
              />
            </label>

            <label>
              Response Summary
              <textarea
                name="response_summary"
                value={form.response_summary}
                onChange={handleChange}
                placeholder="Summarise the AI response..."
                rows="3"
              />
            </label>

            <label>
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Reflection or comments..."
                rows="3"
              />
            </label>

            <div className="checkbox-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="reviewed"
                  checked={form.reviewed}
                  onChange={handleChange}
                />
                Response reviewed
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="improved"
                  checked={form.improved}
                  onChange={handleChange}
                />
                Output improved
              </label>
            </div>

            <button
              className="primary-button submit-button"
              type="submit"
            >
              {editingId
                ? "Update Prompt"
                : "Save Prompt"}
            </button>
          </form>
        </section>

        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="section-label">
                YOUR LIBRARY
              </p>

              <h2>
                Saved Prompts
              </h2>
            </div>

            <div className="record-count">
              {capsules.length}{" "}
              {capsules.length === 1
                ? "record"
                : "records"}
            </div>
          </div>

          {capsules.length === 0 ? (
            <div className="empty-state">
              <h3>
                No prompt records yet
              </h3>

              <p>
                Create your first AI Capsule
                using the form above.
              </p>
            </div>
          ) : (
            <div className="capsule-list">
              {capsules.map((capsule) => (
                <article
                  className="capsule-card"
                  key={capsule.id}
                >
                  <div className="capsule-top">
                    <div>
                      <span className="category-badge">
                        {capsule.category ||
                          "Uncategorised"}
                      </span>

                      <h3>
                        {capsule.prompt_title}
                      </h3>

                      <p className="project-name">
                        {capsule.project_name}
                        {capsule.prompt_version
                          ? ` · ${capsule.prompt_version}`
                          : ""}
                      </p>
                    </div>

                    <div className="card-actions">
                      <button
                        className="edit-button"
                        onClick={() =>
                          startEdit(capsule)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="delete-button"
                        onClick={() =>
                          deleteCapsule(
                            capsule.id
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="record-block">
                    <span>
                      Prompt
                    </span>

                    <p>
                      {capsule.prompt_text}
                    </p>
                  </div>

                  {capsule.response_summary && (
                    <div className="record-block">
                      <span>
                        Response Summary
                      </span>

                      <p>
                        {
                          capsule.response_summary
                        }
                      </p>
                    </div>
                  )}

                  {capsule.notes && (
                    <div className="record-block">
                      <span>
                        Notes
                      </span>

                      <p>
                        {capsule.notes}
                      </p>
                    </div>
                  )}

                  <div className="status-row">
                    <span>
                      Usefulness:{" "}
                      <strong>
                        {capsule.usefulness ||
                          "Not set"}
                      </strong>
                    </span>

                    <span>
                      Reviewed:{" "}
                      <strong>
                        {capsule.reviewed
                          ? "Yes"
                          : "No"}
                      </strong>
                    </span>

                    <span>
                      Improved:{" "}
                      <strong>
                        {capsule.improved
                          ? "Yes"
                          : "No"}
                      </strong>
                    </span>
                  </div>

                  {capsule.screenshot_url && (
                    <a
                      className="evidence-link"
                      href={
                        capsule.screenshot_url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Screenshot Evidence
                    </a>
                  )}

                  <p className="created-at">
                    Created:{" "}
                    {capsule.created_at}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
