import { Router, type IRouter } from "express";
import { db, examsTable } from "@workspace/db";

const BASE_URL = "https://rankyatra.in";

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/dashboard", priority: "0.9", changefreq: "daily" },
  { loc: "/leaderboard", priority: "0.8", changefreq: "daily" },
  { loc: "/results", priority: "0.8", changefreq: "daily" },
  { loc: "/login", priority: "0.6", changefreq: "monthly" },
  { loc: "/signup", priority: "0.6", changefreq: "monthly" },
  { loc: "/about", priority: "0.5", changefreq: "monthly" },
  { loc: "/contact", priority: "0.5", changefreq: "monthly" },
  { loc: "/faq", priority: "0.5", changefreq: "monthly" },
  { loc: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms-conditions", priority: "0.3", changefreq: "yearly" },
];

const router: IRouter = Router();

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  try {
    const now = new Date();
    const exams = await db
      .select({ id: examsTable.id, title: examsTable.title, updatedAt: examsTable.updatedAt, startTime: examsTable.startTime })
      .from(examsTable);

    const examUrls = exams.map((exam) => {
      const lastmod = exam.updatedAt ? new Date(exam.updatedAt).toISOString().split("T")[0] : now.toISOString().split("T")[0];
      return `  <url>
    <loc>${BASE_URL}/exam/${exam.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    const staticUrls = STATIC_PAGES.map((p) => `  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join("\n")}
${examUrls.join("\n")}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch {
    res.status(500).send("Sitemap generation failed");
  }
});

export default router;
