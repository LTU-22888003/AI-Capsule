const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === "production";

const APP_BASE_URL =
  process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";


// ======================================================
// DATABASE
// ======================================================

const dbPath = path.join(__dirname, "ai_capsule.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS capsules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      prompt_title TEXT NOT NULL,
      prompt_version TEXT,
      prompt_text TEXT NOT NULL,
      response_summary TEXT,
      category TEXT,
      usefulness TEXT,
      reviewed INTEGER DEFAULT 0,
      improved INTEGER DEFAULT 0,
      screenshot_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});


// ======================================================
// DATABASE HELPERS
// ======================================================

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function formatCapsule(row) {
  if (!row) return row;

  return {
    ...row,
    reviewed: Boolean(row.reviewed),
    improved: Boolean(row.improved),
  };
}


// ======================================================
// JWT AUTHENTICATION MIDDLEWARE
// ======================================================

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }
}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});


// ======================================================
// GITHUB OAUTH LOGIN
// ======================================================

app.get("/login", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(500).send(
      "GitHub OAuth is not configured."
    );
  }

  const state = crypto.randomBytes(24).toString("hex");

  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const callbackUrl =
    `${APP_BASE_URL}/auth/github/callback`;

  const githubUrl =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(
      process.env.GITHUB_CLIENT_ID
    )}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=read:user` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(githubUrl);
});


// ======================================================
// GITHUB OAUTH CALLBACK
// ======================================================

app.get("/auth/github/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    const savedState = req.cookies.oauth_state;

    if (!code || !state || state !== savedState) {
      return res.status(400).send(
        "Invalid OAuth request."
      );
    }

    res.clearCookie("oauth_state");

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret:
            process.env.GITHUB_CLIENT_SECRET,
          code: code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error(tokenData);

      return res.status(401).send(
        "GitHub authentication failed."
      );
    }

    const userResponse = await fetch(
      "https://api.github.com/user",
      {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,

          Accept:
            "application/vnd.github+json",

          "User-Agent": "AI-Capsule",
        },
      }
    );

    const githubUser = await userResponse.json();

    if (!githubUser.id) {
      return res.status(401).send(
        "Unable to get GitHub user."
      );
    }

    const applicationToken = jwt.sign(
      {
        userId: String(githubUser.id),
        username: githubUser.login,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "24h",
      }
    );

    res.cookie("token", applicationToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(`${FRONTEND_URL}/dashboard`);

  } catch (error) {
    console.error(
      "OAuth callback error:",
      error
    );

    res.status(500).send(
      "Authentication error."
    );
  }
});


// ======================================================
// LOGOUT
// ======================================================

app.get("/logout", (req, res) => {
  res.clearCookie("token");

  res.redirect(FRONTEND_URL);
});


// ======================================================
// CURRENT USER
// ======================================================

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    userId: req.user.userId,
    username: req.user.username,
  });
});


// ======================================================
// READ CAPSULES
// GET /api/capsules
// ======================================================

app.get(
  "/api/capsules",
  requireAuth,
  async (req, res) => {
    try {
      const rows = await dbAll(
        `
        SELECT *
        FROM capsules
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [req.user.userId]
      );

      res.json(rows.map(formatCapsule));

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Failed to load capsules",
      });
    }
  }
);


// ======================================================
// CREATE CAPSULE
// POST /api/capsules
// ======================================================

app.post(
  "/api/capsules",
  requireAuth,
  async (req, res) => {
    try {
      const {
        project_name,
        prompt_title,
        prompt_version,
        prompt_text,
        response_summary,
        category,
        usefulness,
        reviewed,
        improved,
        screenshot_url,
        notes,
      } = req.body;

      if (
        !project_name ||
        !prompt_title ||
        !prompt_text
      ) {
        return res.status(400).json({
          error:
            "Project name, prompt title and prompt text are required",
        });
      }

      const result = await dbRun(
        `
        INSERT INTO capsules (
          user_id,
          project_name,
          prompt_title,
          prompt_version,
          prompt_text,
          response_summary,
          category,
          usefulness,
          reviewed,
          improved,
          screenshot_url,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          req.user.userId,
          project_name,
          prompt_title,
          prompt_version || "",
          prompt_text,
          response_summary || "",
          category || "",
          usefulness || "",
          reviewed ? 1 : 0,
          improved ? 1 : 0,
          screenshot_url || "",
          notes || "",
        ]
      );

      const newCapsule = await dbGet(
        `
        SELECT *
        FROM capsules
        WHERE id = ?
        AND user_id = ?
        `,
        [
          result.id,
          req.user.userId,
        ]
      );

      res.status(201).json(
        formatCapsule(newCapsule)
      );

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Failed to create capsule",
      });
    }
  }
);


// ======================================================
// UPDATE CAPSULE
// PUT /api/capsules/:id
// ======================================================

app.put(
  "/api/capsules/:id",
  requireAuth,
  async (req, res) => {
    try {
      const capsuleId = req.params.id;

      const existing = await dbGet(
        `
        SELECT *
        FROM capsules
        WHERE id = ?
        AND user_id = ?
        `,
        [
          capsuleId,
          req.user.userId,
        ]
      );

      if (!existing) {
        return res.status(404).json({
          error: "Capsule not found",
        });
      }

      const project_name =
        req.body.project_name ??
        existing.project_name;

      const prompt_title =
        req.body.prompt_title ??
        existing.prompt_title;

      const prompt_version =
        req.body.prompt_version ??
        existing.prompt_version;

      const prompt_text =
        req.body.prompt_text ??
        existing.prompt_text;

      const response_summary =
        req.body.response_summary ??
        existing.response_summary;

      const category =
        req.body.category ??
        existing.category;

      const usefulness =
        req.body.usefulness ??
        existing.usefulness;

      const reviewed =
        req.body.reviewed !== undefined
          ? req.body.reviewed
          : Boolean(existing.reviewed);

      const improved =
        req.body.improved !== undefined
          ? req.body.improved
          : Boolean(existing.improved);

      const screenshot_url =
        req.body.screenshot_url ??
        existing.screenshot_url;

      const notes =
        req.body.notes ??
        existing.notes;

      if (
        !project_name ||
        !prompt_title ||
        !prompt_text
      ) {
        return res.status(400).json({
          error:
            "Project name, prompt title and prompt text are required",
        });
      }

      await dbRun(
        `
        UPDATE capsules

        SET
          project_name = ?,
          prompt_title = ?,
          prompt_version = ?,
          prompt_text = ?,
          response_summary = ?,
          category = ?,
          usefulness = ?,
          reviewed = ?,
          improved = ?,
          screenshot_url = ?,
          notes = ?

        WHERE id = ?
        AND user_id = ?
        `,
        [
          project_name,
          prompt_title,
          prompt_version || "",
          prompt_text,
          response_summary || "",
          category || "",
          usefulness || "",
          reviewed ? 1 : 0,
          improved ? 1 : 0,
          screenshot_url || "",
          notes || "",
          capsuleId,
          req.user.userId,
        ]
      );

      const updated = await dbGet(
        `
        SELECT *
        FROM capsules
        WHERE id = ?
        AND user_id = ?
        `,
        [
          capsuleId,
          req.user.userId,
        ]
      );

      res.json(
        formatCapsule(updated)
      );

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Failed to update capsule",
      });
    }
  }
);


// ======================================================
// DELETE CAPSULE
// DELETE /api/capsules/:id
// ======================================================

app.delete(
  "/api/capsules/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result = await dbRun(
        `
        DELETE FROM capsules
        WHERE id = ?
        AND user_id = ?
        `,
        [
          req.params.id,
          req.user.userId,
        ]
      );

      if (result.changes === 0) {
        return res.status(404).json({
          error: "Capsule not found",
        });
      }

      res.json({
        message:
          "Capsule deleted successfully",
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Failed to delete capsule",
      });
    }
  }
);


// ======================================================
// SERVE REACT FRONTEND AFTER BUILD
// ======================================================

const frontendDist = path.join(
  __dirname,
  "..",
  "frontend",
  "dist"
);

if (fs.existsSync(frontendDist)) {

  app.use(
    express.static(frontendDist)
  );

  app.get(
    "/dashboard",
    (req, res) => {
      res.sendFile(
        path.join(
          frontendDist,
          "index.html"
        )
      );
    }
  );

} else {

  app.get("/", (req, res) => {
    res.send(
      "AI Capsule Backend is running"
    );
  });

}


// ======================================================
// SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `AI Capsule server running on port ${PORT}`
  );

  console.log(
    `Health check: ${APP_BASE_URL}/api/health`
  );
});
