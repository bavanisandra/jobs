import { useEffect, useState } from "react";
import "./App.css";

const API = "https://jobs-backend-o5vp.onrender.com/api";

function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    localStorage.getItem("careerToken") || ""
  );

  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [jobType, setJobType] = useState("");

  const [authData, setAuthData] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [applicationData, setApplicationData] = useState({
    full_name: "",
    email: "",
    phone: "",
    college: "",
    course: "",
    graduation_year: "",
    cover_letter: ""
  });

  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function showMessage(text) {
    setMessage(text);
    setError("");
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  async function apiRequest(url, options = {}) {
    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${url}`, {
      ...options,
      headers
      mode: "cors"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logout();
      }

      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setPage("login");
      return;
    }

    async function checkLogin() {
      try {
        const currentUser = await apiRequest("/auth/me");
        setUser(currentUser);
        setPage("home");
      } catch {
        localStorage.removeItem("careerToken");
        setToken("");
        setUser(null);
        setPage("login");
      }
    }

    checkLogin();
    // Run when the stored login token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (user) {
      loadJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadJobs() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) params.set("search", search);
      if (location.trim()) params.set("location", location);
      if (category) params.set("category", category);
      if (jobType) params.set("jobType", jobType);

      const result = await apiRequest(`/jobs?${params.toString()}`);

      setJobs(result);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const data = await apiRequest("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(authData)
      });

      localStorage.setItem("careerToken", data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthData({ name: "", email: "", password: "" });
      showMessage("Account created successfully!");
      setPage("home");

    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const data = await apiRequest("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: authData.email,
          password: authData.password
        })
      });

      localStorage.setItem("careerToken", data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthData({ name: "", email: "", password: "" });
      showMessage("Welcome to CareerConnect!");
      setPage("home");

    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("careerToken");
    setToken("");
    setUser(null);
    setJobs([]);
    setApplications([]);
    setSelectedJob(null);
    setPage("login");
    setMessage("");
    setError("");
  }

  async function openApply(job) {
    setSelectedJob(job);
    setApplicationData({
      full_name: user?.name || "",
      email: user?.email || "",
      phone: "",
      college: "",
      course: "",
      graduation_year: "",
      cover_letter: ""
    });
    setResume(null);
    setPage("apply");
  }

  async function submitApplication(e) {
    e.preventDefault();

    if (!selectedJob) return;

    if (!resume) {
      showError("Please upload your resume.");
      return;
    }

    const formData = new FormData();

    formData.append("job_id", selectedJob.id);

    Object.entries(applicationData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append("resume", resume);

    try {
      setLoading(true);

      const data = await apiRequest("/applications", {
        method: "POST",
        body: formData
      });

      showMessage(data.message);
      setSelectedJob(null);
      setResume(null);
      setPage("myapplications");

      await loadApplications();

    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadApplications() {
    try {
      const result = await apiRequest("/applications/my");
      setApplications(result);
    } catch (err) {
      showError(err.message);
    }
  }

  async function showMyApplications() {
    setPage("myapplications");
    await loadApplications();
  }

  function openHome() {
    setPage("home");
    loadJobs();
  }

  function updateAuth(field, value) {
    setAuthData((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  function updateApplication(field, value) {
    setApplicationData((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  function renderAuth() {
    const isRegister = page === "register";

    return (
      <div className="auth-page">
        <div className="auth-info">
          <div className="auth-brand">CareerConnect</div>
          <div className="auth-info-content">
            <span className="eyebrow">YOUR CAREER STARTS HERE</span>
            <h1>Find the opportunity that moves you forward.</h1>
            <p>
              Discover internships and jobs, build your skills, and take
              the next step in your career.
            </p>

            <div className="auth-benefits">
              <p>✓ Discover student-friendly opportunities</p>
              <p>✓ Apply with your resume</p>
              <p>✓ Track your applications</p>
            </div>
          </div>
        </div>

        <div className="auth-form-side">
          <form
            className="auth-card"
            onSubmit={isRegister ? handleRegister : handleLogin}
          >
            <div className="mobile-brand">CareerConnect</div>

            <span className="eyebrow">
              {isRegister ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
            </span>

            <h2>{isRegister ? "Create an account" : "Login to your account"}</h2>

            <p className="muted">
              {isRegister
                ? "Register to explore jobs and internships."
                : "Enter your details to continue."}
            </p>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            {isRegister && (
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={authData.name}
                  onChange={(e) => updateAuth("name", e.target.value)}
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                placeholder="Enter your email"
                value={authData.email}
                onChange={(e) => updateAuth("email", e.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                value={authData.password}
                onChange={(e) => updateAuth("password", e.target.value)}
                minLength={6}
                required
              />
            </label>

            <button className="primary-button full-button" disabled={loading}>
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create Account"
                  : "Login"}
            </button>

            <p className="auth-switch">
              {isRegister ? "Already have an account?" : "Don't have an account?"}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPage(isRegister ? "login" : "register");
                  setMessage("");
                  setError("");
                }}
              >
                {isRegister ? "Login" : "Register"}
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  function renderHeader() {
    return (
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={openHome}>
            Career<span>Connect</span>
          </button>

          <nav>
            <button
              className={page === "home" ? "nav-link active" : "nav-link"}
              onClick={openHome}
            >
              Home
            </button>

            <button
              className={page === "myapplications" ? "nav-link active" : "nav-link"}
              onClick={showMyApplications}
            >
              My Applications
            </button>
          </nav>

          <div className="header-user">
            <span className="user-greeting">
              Hi, {user?.name?.split(" ")[0]}
            </span>
            <button className="logout-button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>
    );
  }

  function renderTicker() {
    return (
      <div className="ticker">
        <div className="ticker-track">
          <span>Explore new opportunities</span>
          <span>Find internships</span>
          <span>Build your career</span>
          <span>Apply for your dream job</span>
          <span>Explore new opportunities</span>
          <span>Find internships</span>
          <span>Build your career</span>
          <span>Apply for your dream job</span>
        </div>
      </div>
    );
  }

  function renderJobCard(job) {
    return (
      <article className="job-card" key={job.id}>
        <div className="job-card-top">
          <div className="company-icon">
            {job.company?.charAt(0)?.toUpperCase()}
          </div>

          <span className="job-type">{job.job_type}</span>
        </div>

        <h3>{job.title}</h3>
        <p className="company-name">{job.company}</p>

        <div className="job-meta">
          <span>📍 {job.location}</span>
          <span>💰 {job.salary}</span>
          <span>🎓 {job.experience}</span>
        </div>

        <p className="job-description">
          {job.description}
        </p>

        <div className="skills">
          {job.skills?.split(",").map((skill) => (
            <span key={skill}>{skill.trim()}</span>
          ))}
        </div>

        <div className="job-card-footer">
          <span className="category-label">{job.category}</span>
          <button
            className="primary-button apply-button"
            onClick={() => openApply(job)}
          >
            Apply Now
          </button>
        </div>
      </article>
    );
  }

  function renderHome() {
    return (
      <>
        {renderHeader()}
        {renderTicker()}

        <main>
          <section className="hero">
            <div className="hero-content">
              <span className="eyebrow">CAREERCONNECT FOR STUDENTS</span>
              <h1>
                Your future starts with the <span>right opportunity.</span>
              </h1>
              <p>
                Find internships and jobs that help you learn, grow,
                and build your professional future.
              </p>

              <button
                className="primary-button hero-button"
                onClick={() =>
                  document.getElementById("jobs-section")?.scrollIntoView({
                    behavior: "smooth"
                  })
                }
              >
                Explore Opportunities →
              </button>
            </div>

            <div className="hero-visual">
              <div className="visual-card visual-card-one">
                <span>🚀</span>
                <div>
                  <strong>Start your career</strong>
                  <small>One opportunity at a time</small>
                </div>
              </div>

              <div className="visual-card visual-card-two">
                <span>💼</span>
                <div>
                  <strong>Find your next role</strong>
                  <small>Jobs and internships</small>
                </div>
              </div>

              <div className="hero-circle">CC</div>
            </div>
          </section>

          <section className="stats">
            <div>
              <strong>{jobs.length}+</strong>
              <span>Opportunities</span>
            </div>
            <div>
              <strong>12+</strong>
              <span>Career options</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Explore anytime</span>
            </div>
          </section>

          <section className="jobs-section" id="jobs-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FIND YOUR OPPORTUNITY</span>
                <h2>Latest Jobs & Internships</h2>
                <p>Explore opportunities that match your skills.</p>
              </div>
            </div>

            <div className="filter-panel">
              <input
                type="text"
                placeholder="Search job title, company or skill"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Technology">Technology</option>
                <option value="Data Science">Data Science</option>
                <option value="AI & ML">AI & ML</option>
                <option value="Database">Database</option>
                <option value="Design">Design</option>
                <option value="Cloud">Cloud</option>
                <option value="Cyber Security">Cyber Security</option>
              </select>

              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Internship">Internship</option>
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
              </select>

              <button
                className="primary-button search-button"
                onClick={loadJobs}
              >
                Search
              </button>

              <button
  className="clear-button"
  onClick={async () => {
    setSearch("");
    setLocation("");
    setCategory("");
    setJobType("");

    try {
      const result = await apiRequest("/jobs");
      setJobs(result);
    } catch (err) {
      showError(err.message);
    }
  }}
>
  Clear
</button>
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="jobs-grid">
              {loading ? (
                <p className="empty-state">Loading opportunities...</p>
              ) : jobs.length > 0 ? (
                jobs.map(renderJobCard)
              ) : (
                <p className="empty-state">
                  No jobs found. Try changing your search filters.
                </p>
              )}
            </div>
          </section>
        </main>

        <footer className="footer">
          <h3>CareerConnect</h3>
          <p>Connecting students with opportunities.</p>
          <p>© {new Date().getFullYear()} CareerConnect. All rights reserved.</p>
        </footer>
      </>
    );
  }

  function renderApplyPage() {
    return (
      <>
        {renderHeader()}

        <main className="form-page">
          <button className="back-button" onClick={openHome}>
            ← Back to jobs
          </button>

          <div className="application-card">
            <span className="eyebrow">JOB APPLICATION</span>
            <h2>Apply for {selectedJob?.title}</h2>
            <p className="muted">
              {selectedJob?.company} · {selectedJob?.location}
            </p>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={submitApplication}>
              <div className="form-grid">
                <label>
                  Full Name *
                  <input
                    value={applicationData.full_name}
                    onChange={(e) =>
                      updateApplication("full_name", e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Email *
                  <input
                    type="email"
                    value={applicationData.email}
                    onChange={(e) =>
                      updateApplication("email", e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Phone Number *
                  <input
                    type="tel"
                    value={applicationData.phone}
                    onChange={(e) =>
                      updateApplication("phone", e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  College Name *
                  <input
                    value={applicationData.college}
                    onChange={(e) =>
                      updateApplication("college", e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Course / Branch *
                  <select
                    value={applicationData.course}
                    onChange={(e) =>
                      updateApplication("course", e.target.value)
                    }
                    required
                  >
                    <option value="">Select your course</option>
                    <option value="CSE">Computer Science (CSE)</option>
                    <option value="IT">Information Technology (IT)</option>
                    <option value="ECE">Electronics (ECE)</option>
                    <option value="EEE">Electrical (EEE)</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  Graduation Year *
                  <select
                    value={applicationData.graduation_year}
                    onChange={(e) =>
                      updateApplication("graduation_year", e.target.value)
                    }
                    required
                  >
                    <option value="">Select year</option>
                    {Array.from({ length: 8 }, (_, i) => 2026 + i).map(
                      (year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label>
                Cover Letter
                <textarea
                  rows="5"
                  placeholder="Tell the company why you are suitable for this role..."
                  value={applicationData.cover_letter}
                  onChange={(e) =>
                    updateApplication("cover_letter", e.target.value)
                  }
                />
              </label>

              <label>
                Upload Resume * (PDF, DOC or DOCX; maximum 5 MB)
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResume(e.target.files[0] || null)}
                  required
                />
                {resume && (
                  <small className="file-name">
                    Selected: {resume.name}
                  </small>
                )}
              </label>

              <button
                type="submit"
                className="primary-button full-button"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </div>
        </main>
      </>
    );
  }

  function renderApplications() {
    return (
      <>
        {renderHeader()}

        <main className="applications-page">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR CAREER ACTIVITY</span>
              <h2>My Applications</h2>
              <p>View the jobs you have applied for.</p>
            </div>
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {applications.length > 0 ? (
            <div className="applications-list">
              {applications.map((application) => (
                <article className="application-item" key={application.id}>
                  <div className="company-icon">
                    {application.company?.charAt(0)?.toUpperCase()}
                  </div>

                  <div className="application-info">
                    <h3>{application.title}</h3>
                    <p>{application.company}</p>
                    <span>
                      📍 {application.location} · {application.job_type}
                    </span>
                    <small>
                      Applied on{" "}
                      {new Date(application.created_at).toLocaleDateString()}
                    </small>
                  </div>

                  <span
                    className={`status ${
                      application.status?.toLowerCase() || "pending"
                    }`}
                  >
                    {application.status}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-applications">
              <div>📄</div>
              <h3>No applications yet</h3>
              <p>Explore jobs and submit your first application.</p>
              <button className="primary-button" onClick={openHome}>
                Explore Jobs
              </button>
            </div>
          )}
        </main>
      </>
    );
  }

  if (!user) {
    return renderAuth();
  }

  if (page === "apply" && selectedJob) {
    return renderApplyPage();
  }

  if (page === "myapplications") {
    return renderApplications();
  }

  return renderHome();
}

export default App;