import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

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
    
    // Accept any valid email/password for local development
    // In production, replace with proper database authentication
    if (email && password && password.length >= 6) {
      const nameParts = email.split("@")[0].split(".");
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "User";
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "";
      
      (req.session as any).user = {
        id: `user-${Date.now()}`,
        email: email,
        firstName: firstName,
        lastName: lastName,
      };
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Please enter a valid email and password (min 6 characters)" });
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
