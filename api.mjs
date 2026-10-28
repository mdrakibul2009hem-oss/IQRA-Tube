import { getStore } from "@netlify/blobs";

const store = () => getStore("iqra");
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const get = async (k, def) => (await store().get(k, { type: "json" })) || def;
const put = (k, v) => store().setJSON(k, v);
const isAdmin = (req) => process.env.ADMIN_PASS && req.headers.get("x-admin") === process.env.ADMIN_PASS;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

async function rssFeed(id) {
  const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + id, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error("Could not load this channel's videos (" + r.status + ")");
  const xml = await r.text();
  const name = dec(((xml.split("<entry>")[0].match(/<title>([^<]*)<\/title>/)) || [])[1] || "");
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((m) => ({
      id: (m[1].match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1],
      title: dec((m[1].match(/<title>([^<]*)<\/title>/) || [])[1] || ""),
      ch: id,
      pub: (m[1].match(/<published>([^<]*)<\/published>/) || [])[1] || "",
    }))
    .filter((v) => v.id);
  return { name, videos };
}

async function resolve(input) {
  input = String(input || "").trim();
  let id;
  let m = input.match(/channel\/(UC[\w-]{22})/) || input.match(/^(UC[\w-]{22})$/);
  if (m) id = m[1];
  else {
    m = input.match(/@([\w.\-]+)/);
    if (!m) throw new Error("Use a channel link like https://youtube.com/@name or a channel ID starting with UC");
    const r = await fetch("https://www.youtube.com/@" + m[1], {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+1; SOCS=CAI" },
    });
    if (!r.ok) throw new Error("Channel page not found");
    const html = await r.text();
    const x = html.match(/channel_id=(UC[\w-]{22})/) || html.match(/"externalId":"(UC[\w-]{22})"/);
    if (!x) throw new Error("Could not read the channel ID. Paste the channel ID (starts with UC) instead.");
    id = x[1];
  }
  const f = await rssFeed(id);
  return { id, name: f.name || id };
}

const uploads = async (ch) => (await rssFeed(ch.id)).videos;

async function feed() {
  const c = await get("feed", null);
  let vids;
  if (c && Date.now() - c.t < 30 * 60 * 1000) vids = c.videos;
  else {
    const chs = await get("channels", []);
    const all = await Promise.all(chs.map((ch) => uploads(ch).catch(() => [])));
    vids = all.flat().sort((a, b) => b.pub.localeCompare(a.pub));
    await put("feed", { t: Date.now(), videos: vids });
  }
  const bl = await get("blocked", []);
  return vids.filter((v) => !bl.includes(v.id));
}

export default async (req) => {
  try {
    const path = new URL(req.url).pathname.replace(/^\/api/, "") || "/";
    const m = req.method;
    if (path === "/catalog" && m === "GET") return J({ channels: await get("channels", []) });
    if (path === "/feed" && m === "GET") return J({ videos: await feed() });
    if (path === "/report" && m === "POST") {
      const { id } = await req.json();
      if (!/^[\w-]{11}$/.test(id || "")) return J({ error: "Bad video id" }, 400);
      const r = await get("reports", []);
      if (!r.includes(id)) { r.push(id); await put("reports", r); }
      return J({ ok: 1 });
    }
    if (!isAdmin(req)) return J({ error: "Wrong admin password" }, 401);
    if (path === "/admin" && m === "GET") return J({ reports: await get("reports", []), blocked: await get("blocked", []) });
    if (path === "/channels" && m === "POST") {
      const { input, cat } = await req.json();
      const c = await resolve(input);
      c.cat = String(cat || "General").slice(0, 30);
      const list = await get("channels", []);
      if (!list.some((x) => x.id === c.id)) list.push(c);
      await put("channels", list);
      await store().delete("feed");
      return J({ ok: 1, channel: c });
    }
    if (path.startsWith("/channels/") && m === "DELETE") {
      const id = path.split("/")[2];
      await put("channels", (await get("channels", [])).filter((x) => x.id !== id));
      await store().delete("feed");
      return J({ ok: 1 });
    }
    if (path === "/block" && m === "POST") {
      const { id, block } = await req.json();
      let bl = (await get("blocked", [])).filter((x) => x !== id);
      if (block) bl.push(id);
      await put("blocked", bl);
      await put("reports", (await get("reports", [])).filter((x) => x !== id));
      return J({ ok: 1 });
    }
    return J({ error: "Not found" }, 404);
  } catch (e) {
    return J({ error: e.message }, 500);
  }
};

export const config = { path: "/api/*" };
