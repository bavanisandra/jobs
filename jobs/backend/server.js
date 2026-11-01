const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const db = require("./db");

const app = express();

app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://jobs-dzrn-msujw2d6f-job-internships-portal.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
}

// Create uploads folder if it does not exist.
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Resume upload configuration.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1e9);

        cb(null, uniqueName + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = [".pdf", ".doc", ".docx"];
        const extension = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            return cb(new Error("Only PDF, DOC and DOCX files are allowed."));
        }

        cb(null, true);
    }
});

// Authentication middleware.
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please login first."
        });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                message: "Invalid or expired login. Please login again."
            });
        }

        req.user = user;
        next();
    });
}

// Test route.
app.get("/", (req, res) => {
    res.send("CareerConnect backend is running!");
});

// REGISTER.
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill all fields."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [existingUsers] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "Email already registered. Please login."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name.trim(), normalizedEmail, hashedPassword]
        );

        const user = {
            id: result.insertId,
            name: name.trim(),
            email: normalizedEmail
        };

        const token = jwt.sign(
            user,
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(201).json({
            message: "Registration successful!",
            token,
            user
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            message: "Registration failed."
        });
    }
});

// LOGIN.
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Enter email and password."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const safeUser = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        const token = jwt.sign(
            safeUser,
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful!",
            token,
            user: safeUser
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            message: "Login failed."
        });
    }
});

// GET LOGGED-IN USER.
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const [users] = await db.query(
            "SELECT id, name, email FROM users WHERE id = ?",
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        res.json(users[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Could not get user details."
        });
    }
});

// GET ALL JOBS WITH SEARCH AND FILTERS.
app.get("/api/jobs", async (req, res) => {
    try {
        const {
            search = "",
            location = "",
            category = "",
            jobType = ""
        } = req.query;

        let sql = "SELECT * FROM jobs WHERE 1=1";
        const values = [];

        if (search.trim()) {
            sql += ` AND (
                title LIKE ? OR
                company LIKE ? OR
                skills LIKE ? OR
                description LIKE ?
            )`;

            const term = `%${search.trim()}%`;
            values.push(term, term, term, term);
        }

        if (location.trim()) {
            sql += " AND location LIKE ?";
            values.push(`%${location.trim()}%`);
        }

        if (category.trim()) {
            sql += " AND category = ?";
            values.push(category);
        }

        if (jobType.trim()) {
            sql += " AND job_type = ?";
            values.push(jobType);
        }

        sql += " ORDER BY created_at DESC";

        const [jobs] = await db.query(sql, values);

        res.json(jobs);

    } catch (error) {
        console.error("Jobs error:", error);
        res.status(500).json({
            message: "Could not load jobs."
        });
    }
});

// GET ONE JOB.
app.get("/api/jobs/:id", async (req, res) => {
    try {
        const [jobs] = await db.query(
            "SELECT * FROM jobs WHERE id = ?",
            [req.params.id]
        );

        if (jobs.length === 0) {
            return res.status(404).json({
                message: "Job not found."
            });
        }

        res.json(jobs[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Could not load job."
        });
    }
});

// APPLY FOR A JOB.
app.post(
    "/api/applications",
    authenticateToken,
    upload.single("resume"),
    async (req, res) => {
        try {
            const {
                job_id,
                full_name,
                email,
                phone,
                college,
                course,
                graduation_year,
                cover_letter
            } = req.body;

            if (
                !job_id ||
                !full_name ||
                !email ||
                !phone ||
                !college ||
                !course ||
                !graduation_year
            ) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({
                    message: "Please complete all required fields."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "Please upload your resume."
                });
            }

            const [jobs] = await db.query(
                "SELECT id FROM jobs WHERE id = ?",
                [job_id]
            );

            if (jobs.length === 0) {
                fs.unlinkSync(req.file.path);

                return res.status(404).json({
                    message: "Job not found."
                });
            }

            const [existing] = await db.query(
                "SELECT id FROM applications WHERE user_id = ? AND job_id = ?",
                [req.user.id, job_id]
            );

            if (existing.length > 0) {
                fs.unlinkSync(req.file.path);

                return res.status(409).json({
                    message: "You have already applied for this job."
                });
            }

            const resumePath = req.file.filename;

            await db.query(
                `INSERT INTO applications
                (user_id, job_id, full_name, email, phone,
                 college, course, graduation_year, cover_letter, resume_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.id,
                    job_id,
                    full_name,
                    email,
                    phone,
                    college,
                    course,
                    graduation_year,
                    cover_letter || "",
                    resumePath
                ]
            );

            res.status(201).json({
                message: "Application submitted successfully!"
            });

        } catch (error) {
            console.error("Application error:", error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    message: "Resume must be 5 MB or smaller."
                });
            }

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "You have already applied for this job."
                });
            }

            res.status(500).json({
                message: error.message || "Application failed."
            });
        }
    }
);

// GET MY APPLICATIONS.
app.get(
    "/api/applications/my",
    authenticateToken,
    async (req, res) => {
        try {
            const [applications] = await db.query(
                `SELECT
                    a.id,
                    a.job_id,
                    a.full_name,
                    a.email,
                    a.status,
                    a.created_at,
                    j.title,
                    j.company,
                    j.location,
                    j.job_type,
                    j.category
                 FROM applications a
                 JOIN jobs j ON a.job_id = j.id
                 WHERE a.user_id = ?
                 ORDER BY a.created_at DESC`,
                [req.user.id]
            );

            res.json(applications);

        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Could not load applications."
            });
        }
    }
);

// Upload errors.
app.use((err, req, res, next) => {
    console.error(err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            message: err.code === "LIMIT_FILE_SIZE"
                ? "Resume must be 5 MB or smaller."
                : err.message
        });
    }

    if (err) {
        return res.status(400).json({
            message: err.message || "Upload failed."
        });
    }

    next();
});

app.listen(PORT, () => {
    console.log(`CareerConnect backend running at http://localhost:${PORT}`);
});