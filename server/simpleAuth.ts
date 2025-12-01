import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";
import { storage } from "./storage";

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

 
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    if (email && password && password.length >= 6) {
      const nameParts = email.split("@")[0].split(".");
      const firstName = nameParts[0]
        ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
        : "User";
      const lastName = nameParts[1]
        ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
        : "";

      // 1) Upsert user in DB based on email
      const dbUser = await storage.upsertUser({
        email,
        firstName,
        lastName,
        // id is omitted → DB will generate for new user
      });

      // 2) Store DB user in session
      (req.session as any).user = {
        id: dbUser.id,              // real DB id
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      };

      res.json({ success: true });
    } else {
      res
        .status(401)
        .json({ message: "Please enter a valid email and password (min 6 characters)" });
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
