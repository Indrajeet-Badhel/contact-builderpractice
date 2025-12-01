import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

const TEST_USER = {
  email: "test@example.com",
  password: "password123"
};

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret-key-change-in-production",
    store: new MemoryStoreSession({
      checkPeriod: sessionTtl,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    
    if (email === TEST_USER.email && password === TEST_USER.password) {
      (req.session as any).user = {
        id: "user-1",
        email: email,
        firstName: "Test",
        lastName: "User",
      };
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = { claims: { sub: user.id }, ...user };
  next();
};
